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
  it('has finite quotas', () => expect(DEMO_QUOTAS).toEqual({ recordings: 3, reports: 5, assistant: 10 }));
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
  it('denies the 6th report and 11th assistant call before any provider invocation', async () => {
    const { consume, reserve } = memoryReserve(); let provider = 0;
    const act = async (kind: 'reports' | 'assistant', ip: string) => { await reserveQuota(consume, reserve, kind, 'sid-1', ip); provider++; };
    for (let i = 0; i < 5; i++) await act('reports', `ip${i}`);
    await expect(act('reports', 'ip9')).rejects.toThrow(/сесия е изчерпан/);
    expect(provider).toBe(5);
    for (let i = 0; i < 10; i++) await act('assistant', `a${i}`);
    await expect(act('assistant', 'a99')).rejects.toThrow(/сесия е изчерпан/);
    expect(provider).toBe(15);
  });
  it('throttles more than 20 requests per minute per IP', async () => {
    const { consume, reserve } = memoryReserve();
    for (let i = 0; i < 20; i++) await reserveQuota(consume, reserve, 'assistant', `s${i}`, 'same');
    await expect(reserveQuota(consume, reserve, 'assistant', 'new', 'same')).rejects.toThrow(/минута/);
  });
  it('a rejected session spends nothing from network or global daily budgets (atomic)', async () => {
    const { consume, reserve, rows } = memoryReserve();
    for (let i = 0; i < 5; i++) await reserveQuota(consume, reserve, 'reports', 'sidA', 'ip1');
    const before = { ip: rows.get('ip:ip1:day:reports')!.used, global: rows.get('global:day:reports')!.used };
    await expect(reserveQuota(consume, reserve, 'reports', 'sidA', 'ip1')).rejects.toThrow(/сесия/);
    expect(rows.get('ip:ip1:day:reports')!.used).toBe(before.ip);
    expect(rows.get('global:day:reports')!.used).toBe(before.global);
  });
  it('global daily ceiling rejects without debiting the new session', async () => {
    let now = 0; const { consume, reserve, rows } = memoryReserve(() => now);
    for (let i = 0; i < DEMO_GLOBAL_DAILY.recordings; i++) { now += 61_000; await reserveQuota(consume, reserve, 'recordings', `s${i}`, `ip${i % 50}`); }
    now += 61_000;
    await expect(reserveQuota(consume, reserve, 'recordings', 'fresh', 'ipX')).rejects.toThrow(/общ лимит/);
    expect(rows.get('sid:fresh:recordings')).toBeUndefined();
  });
  it('rolls the window over after 24h and concurrent reservations never exceed the limit', async () => {
    let now = 0; const { consume, reserve } = memoryReserve(() => now);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserveQuota(consume, reserve, 'recordings', 'sidC', `ip${i}`)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3);
    now += 86_401_000;
    await expect(reserveQuota(consume, reserve, 'recordings', 'sidC', 'ip0')).resolves.toBe(2);
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
