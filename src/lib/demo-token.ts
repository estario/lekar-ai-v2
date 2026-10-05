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
/** Reserves all counters for one billable demo action; throws before any provider call when exhausted. */
export async function reserveQuota(consume: Consume, kind: DemoQuotaKind, sid: string, ipHash: string) {
  if ((await consume(`ip:${ipHash}:min`, 20, 60)) < 0) throw new Error('Твърде много заявки. Изчакайте минута.');
  if ((await consume(`ip:${ipHash}:day:${kind}`, DEMO_QUOTAS[kind] * 6, 86400)) < 0) throw new Error('Дневният лимит на демото за тази мрежа е изчерпан.');
  const left = await consume(`sid:${sid}:${kind}`, DEMO_QUOTAS[kind], 86400);
  if (left < 0) throw new Error('Лимитът за тази демо сесия е изчерпан. Започнете нова демо сесия.');
  return left;
}

