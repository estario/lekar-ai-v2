import { describe, expect, it } from 'vitest';
import { DEMO_QUOTAS, DEMO_TTL_SECONDS, isSameOrigin, signDemoToken, verifyDemoToken } from '@/lib/demo-token';

const S = 'synthetic-test-secret-not-real';
describe('demo session token', () => {
  it('round-trips a fresh token', async () => {
    const { token, claims } = await signDemoToken(S, 1000);
    expect((await verifyDemoToken(S, token, 1001)).sid).toBe(claims.sid);
    expect(claims.exp - claims.iat).toBe(DEMO_TTL_SECONDS);
  });
  it('rejects expired tokens', async () => {
    const { token } = await signDemoToken(S, 1000);
    await expect(verifyDemoToken(S, token, 1000 + DEMO_TTL_SECONDS)).rejects.toThrow(/изтече/);
  });
  it('rejects tampered payload, signature and foreign secret', async () => {
    const { token } = await signDemoToken(S, 1000);
    const [body, sig] = token.split('.');
    const forged = btoa(JSON.stringify({ sid: 'x', iat: 1000, exp: 9e9, v: 1 })).replace(/=+$/, '');
    await expect(verifyDemoToken(S, `${forged}.${sig}`, 1001)).rejects.toThrow();
    await expect(verifyDemoToken(S, `${body}.${sig!.slice(0, -2)}AA`, 1001)).rejects.toThrow();
    await expect(verifyDemoToken('other', token, 1001)).rejects.toThrow();
    await expect(verifyDemoToken(S, `${token}.x`, 1001)).rejects.toThrow();
  });
  it('issues distinct sessions per visitor', async () => {
    const a = await signDemoToken(S); const b = await signDemoToken(S);
    expect(a.claims.sid).not.toBe(b.claims.sid);
  });
  it('enforces same-origin requests', () => {
    expect(isSameOrigin(new Headers({ host: 'a.app', origin: 'https://a.app' }))).toBe(true);
    expect(isSameOrigin(new Headers({ host: 'a.app', origin: 'https://evil.app' }))).toBe(false);
    expect(isSameOrigin(new Headers({ host: 'a.app' }))).toBe(false);
  });
  it('has finite quotas', () => expect(DEMO_QUOTAS).toEqual({ recordings: 100000, reports: 100000, assistant: 100000 }));
});

import { DEMO_GLOBAL_DAILY, isAllowedOrigin, memoryReserve, normalizeClientIp, reserveQuota } from '@/lib/demo-token';
describe('demo origin allowlist', () => {
  const H = (o: Record<string, string>) => new Headers(o);
  it('accepts preview, embedded preview and published hosts for this project', () => {
    expect(isAllowedOrigin(H({ host: 'internal.worker', origin: 'https://8edcb921-cddd-47da-b742-f78009807ab8.lovableproject.com' }))).toBe(true);
    expect(isAllowedOrigin(H({ host: 'x', origin: 'https://id-preview--8edcb921-cddd-47da-b742-f78009807ab8.lovable.app' }))).toBe(true);
    expect(isAllowedOrigin(H({ host: 'x', origin: 'https://project--8edcb921-cddd-47da-b742-f78009807ab8.lovable.app' }))).toBe(true);
    expect(isAllowedOrigin(H({ host: 'x' , origin: 'https://lekar-demo.lovable.app' }), 'https://lekar-demo.lovable.app/_serverFn/abc')).toBe(true);
    expect(isAllowedOrigin(H({ host: 'x', 'x-forwarded-host': 'demo.example.bg', origin: 'https://demo.example.bg' }))).toBe(true);
  });
  it('rejects unrelated or spoofed origins', () => {
    expect(isAllowedOrigin(H({ host: 'x', origin: 'https://evil.lovable.app' }))).toBe(false);
    expect(isAllowedOrigin(H({ host: 'x', origin: 'https://8edcb921-cddd-47da-b742-f78009807ab8.lovableproject.com.evil.com' }))).toBe(false);
    expect(isAllowedOrigin(H({ host: 'x', origin: 'https://other-11111111-cddd-47da-b742-f78009807ab8.lovableproject.com' }))).toBe(false);
    expect(isAllowedOrigin(H({ host: 'x' }))).toBe(false);
  });
});
describe('demo quota reservation (in-memory model of demo_reserve, no provider)', () => {
  // Limits are temporarily lifted in src/lib/demo-token.ts; these tests exercise the same
  // reserve/consume semantics with small explicit limits so the logic stays covered.
  it('denies beyond the session limit before any provider invocation', async () => {
    const { reserve } = memoryReserve(); let provider = 0;
    const act = async () => {
      const r = await reserve([{ bucket: 'sid:t', limit: 5, window: 86400 }]);
      if (!r.ok) throw new Error('Лимитът за тази демо сесия е изчерпан. Започнете нова демо сесия.');
      provider++;
    };
    for (let i = 0; i < 5; i++) await act();
    await expect(act()).rejects.toThrow(/сесия е изчерпан/);
    expect(provider).toBe(5);
  });
  it('per-minute consume throttle rejects beyond the limit', async () => {
    const { consume } = memoryReserve();
    for (let i = 0; i < 20; i++) expect(await consume('ip:x:min', 20, 60)).toBeGreaterThanOrEqual(0);
    expect(await consume('ip:x:min', 20, 60)).toBeLessThan(0);
  });
  it('a rejected multi-bucket reservation spends nothing (atomic)', async () => {
    const { reserve, rows } = memoryReserve();
    const items = [
      { bucket: 'sid:t', limit: 2, window: 86400 },
      { bucket: 'ip:t:day', limit: 100, window: 86400 },
      { bucket: 'global:day', limit: 100, window: 86400 },
    ];
    await reserve(items); await reserve(items);
    const before = { ip: rows.get('ip:t:day')!.used, global: rows.get('global:day')!.used };
    const r = await reserve(items);
    expect(r.ok).toBe(false);
    expect(rows.get('ip:t:day')!.used).toBe(before.ip);
    expect(rows.get('global:day')!.used).toBe(before.global);
  });
  it('global ceiling rejects without debiting the new session bucket', async () => {
    let now = 0; const { reserve, rows } = memoryReserve(() => now);
    const items = (sid: string) => [
      { bucket: `sid:${sid}`, limit: 100, window: 86400 },
      { bucket: 'global:day', limit: 3, window: 86400 },
    ];
    for (let i = 0; i < 3; i++) { now += 61_000; await reserve(items(`s${i}`)); }
    now += 61_000;
    const r = await reserve(items('fresh'));
    expect(r.ok).toBe(false);
    expect(rows.get('sid:fresh')).toBeUndefined();
  });
  it('rolls the window over after 24h and concurrent reservations never exceed the limit', async () => {
    let now = 0; const { reserve } = memoryReserve(() => now);
    const items = { bucket: 'sid:t', limit: 3, window: 86400 };
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => reserve([items])));
    expect(results.filter(r => r.status === 'fulfilled' && r.value.ok)).toHaveLength(3);
    now += 86_401_000;
    const r = await reserve([items]);
    expect(r).toMatchObject({ ok: true, remaining: [2] });
  });
});
describe('client IP normalization', () => {
  it('collapses IPv6 to /64 and refuses junk', () => {
    expect(normalizeClientIp('2001:db8:1:2:aaaa::1')).toBe(normalizeClientIp('2001:0db8:0001:0002:ffff:1:2:3'));
    expect(normalizeClientIp('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(normalizeClientIp('2001:db8:1:3::1')).not.toBe(normalizeClientIp('2001:db8:1:2::1'));
    expect(normalizeClientIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    expect(normalizeClientIp('203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeClientIp(null)).toBe('unknown-shared');
    expect(normalizeClientIp('evil, 1.2.3.4')).toBe('unknown-shared');
  });
});
describe('published host', () => {
  it('accepts lekari-ai-bulgaria.lovable.app even behind a proxy host', () => {
    expect(isAllowedOrigin(new Headers({ host: 'internal', origin: 'https://lekari-ai-bulgaria.lovable.app' }))).toBe(true);
    expect(isAllowedOrigin(new Headers({ host: 'internal', origin: 'https://lekari-ai-bulgaria.lovable.app.evil.com' }))).toBe(false);
  });
});
