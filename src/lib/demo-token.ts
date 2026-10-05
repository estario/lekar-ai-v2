// Pure, runtime-agnostic helpers for the public demo session token (Web Crypto only).
// Token = base64url(payload).base64url(HMAC-SHA256(payload)). Contains no user data.
export type DemoClaims = { sid: string; iat: number; exp: number; v: 1 };
export const DEMO_TTL_SECONDS = 2 * 60 * 60;
export const DEMO_QUOTAS = { recordings: 3, reports: 5, assistant: 10 } as const;
export type DemoQuotaKind = keyof typeof DEMO_QUOTAS;

const enc = new TextEncoder();
function b64url(bytes: Uint8Array) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function hmacKey(secret: string) {
  // Derive a purpose-bound key so the raw server secret is never used directly as the demo signing key.
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = new Uint8Array(await crypto.subtle.sign('HMAC', base, enc.encode('lekar-ai-v2/demo-session/v1')));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signDemoToken(secret: string, now = Math.floor(Date.now() / 1000)) {
  const claims: DemoClaims = { sid: crypto.randomUUID(), iat: now, exp: now + DEMO_TTL_SECONDS, v: 1 };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return { token: `${body}.${b64url(sig)}`, claims };
}
export async function verifyDemoToken(secret: string, token: string, now = Math.floor(Date.now() / 1000)): Promise<DemoClaims> {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined || token.length > 600) throw new Error('Невалидна демо сесия.');
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(body)); } catch { ok = false; }
  if (!ok) throw new Error('Невалидна демо сесия.');
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as DemoClaims;
  if (claims.v !== 1 || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') throw new Error('Невалидна демо сесия.');
  if (claims.exp <= now) throw new Error('Демо сесията изтече. Започнете отначало.');
  return claims;
}
export async function sha256Hex(value: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}
const PROJECT_HOST = /(^|[.-])8edcb921-cddd-47da-b742-f78009807ab8(-dev)?\.(lovableproject\.com|lovable\.app)$/;
/** Planned published Lovable host(s) for this project. */
export const PUBLISHED_HOSTS = ['lekari-ai-bulgaria.lovable.app'];
/** Origin (or Referer) must be this deployment: same host as the request (incl. proxy-forwarded host),
 *  or a Lovable preview/published host bound to this project's id. Unrelated origins are rejected. */
export function isAllowedOrigin(headers: Headers, requestUrl?: string) {
  const origin = headers.get('origin') || headers.get('referer');
  if (!origin) return false;
  let originHost: string;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return false; }
  const hosts = [headers.get('host'), headers.get('x-forwarded-host'), headers.get('x-original-host')].flatMap(h => (h || '').split(',')).map(h => h.trim().toLowerCase()).filter(Boolean);
  if (requestUrl) { try { hosts.push(new URL(requestUrl).host.toLowerCase()); } catch { /* ignore */ } }
  if (hosts.includes(originHost)) return true;
  const bare = originHost.split(':')[0]!;
  return PUBLISHED_HOSTS.includes(bare) || PROJECT_HOST.test(bare);
}
export const isSameOrigin = (headers: Headers) => isAllowedOrigin(headers);

export type Consume = (bucket: string, limit: number, windowSeconds: number) => Promise<number>;
export type ReserveItem = { bucket: string; limit: number; window: number };
/** All-or-nothing reservation across buckets (service-only demo_reserve RPC). */
export type Reserve = (items: ReserveItem[]) => Promise<{ ok: true; remaining: number[] } | { ok: false; failed: number }>;
/** Conservative global demo provider ceilings per day (all visitors together). */
export const DEMO_GLOBAL_DAILY = { recordings: 100, reports: 200, assistant: 400 } as const;
export const DEMO_IP_DAILY_FACTOR = 6;
export const DEMO_IP_PER_MINUTE = 20;

/**
 * Reserves one billable demo action. The per-minute IP throttle is independent abuse throttling.
 * Session, network-day and global-day buckets are reserved atomically: a rejected session spends
 * nothing from shared daily budgets. Attempts are not refunded on provider errors (may be billable).
 */
export async function reserveQuota(consume: Consume, reserve: Reserve, kind: DemoQuotaKind, sid: string, ipHash: string) {
  if ((await consume(`ip:${ipHash}:min`, DEMO_IP_PER_MINUTE, 60)) < 0) throw new Error('Твърде много заявки. Изчакайте минута.');
  const items: ReserveItem[] = [
    { bucket: `sid:${sid}:${kind}`, limit: DEMO_QUOTAS[kind], window: 86400 },
    { bucket: `ip:${ipHash}:day:${kind}`, limit: DEMO_QUOTAS[kind] * DEMO_IP_DAILY_FACTOR, window: 86400 },
    { bucket: `global:day:${kind}`, limit: DEMO_GLOBAL_DAILY[kind], window: 86400 },
  ];
  const r = await reserve(items);
  if (!r.ok) {
    if (r.failed === 0) throw new Error('Лимитът за тази демо сесия е изчерпан. Започнете нова демо сесия.');
    if (r.failed === 1) throw new Error('Дневният лимит на демото за тази мрежа е изчерпан.');
    throw new Error('Дневният общ лимит на демото е изчерпан. Опитайте утре.');
  }
  return r.remaining[0]!;
}

/** In-memory model of demo_reserve semantics (tests/fixtures only; the DB function is authoritative). */
export function memoryReserve(now: () => number = () => Date.now()) {
  const rows = new Map<string, { used: number; start: number }>();
  const reserve: Reserve = async items => {
    const t = now(); const rem: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!; const row = rows.get(it.bucket);
      const cur = !row || row.start < t - it.window * 1000 ? 0 : row.used;
      if (cur + 1 > it.limit) return { ok: false, failed: i };
      rem.push(it.limit - cur - 1);
    }
    for (const it of items) { const row = rows.get(it.bucket); rows.set(it.bucket, !row || row.start < t - it.window * 1000 ? { used: 1, start: t } : { used: row.used + 1, start: row.start }); }
    return { ok: true, remaining: rem };
  };
  const consume: Consume = async (bucket, limit, window) => {
    const t = now(); const row = rows.get(bucket);
    const next = !row || row.start < t - window * 1000 ? { used: 1, start: t } : { used: row.used + 1, start: row.start };
    rows.set(bucket, next); return limit - next.used;
  };
  return { reserve, consume, rows };
}

/** Normalizes the ingress client IP: IPv6 collapsed to its /64 so address rotation inside one prefix shares a budget. */
export function normalizeClientIp(raw: string | null | undefined): string {
  const ip = (raw ?? '').trim().toLowerCase();
  if (!ip) return 'unknown-shared';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (!ip.includes(':')) return 'unknown-shared';
  const v4mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4mapped) return v4mapped[1]!;
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  if (ip.includes('::') ? h.length + t.length > 7 : h.length !== 8) return 'unknown-shared';
  const full = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  if (full.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return 'unknown-shared';
  return full.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
