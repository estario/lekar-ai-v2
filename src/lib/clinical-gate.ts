// Server-side gate for every clinical AI / transcription / integration handler.
// Order is fixed: role check -> complete input validation -> minute + daily budget -> provider.
// Any lookup failure fails closed. No role is ever granted automatically.
export type RpcClient = { rpc: (fn: any, args?: any) => PromiseLike<{ data: unknown; error: unknown }> };
export type ClinicalKind = 'report' | 'assistant' | 'recording';

export const NOT_APPROVED = 'Профилът не е одобрен за клинична работа. Използвайте демото.';
export const BUDGET_UNAVAILABLE = 'Лимитът не може да бъде проверен. Опитайте по-късно.';
export const DAILY_EXHAUSTED = 'Дневният клиничен лимит за тази услуга е изчерпан.';
export const MINUTE_EXHAUSTED = 'Достигнат е лимитът от заявки. Опитайте отново след минута.';
export const CLINICAL_OUTPUT_CAPS = { report: 3000, assistant: 2000 } as const;
export const CLINICAL_SONIOX_MAX_SECONDS = 300;
/** Mirrors reserve_clinical_budget() in migration 0005 (documentation/tests only; DB is authoritative). */
export const CLINICAL_DAILY_LIMITS = { report: 40, assistant: 120, recording: 20 } as const;

export async function requireClinicalAccess(sb: RpcClient) {
  let res: { data: unknown; error: unknown };
  try { res = await sb.rpc('is_clinical_user'); } catch { throw new Error(NOT_APPROVED); }
  if (res.error || res.data !== true) throw new Error(NOT_APPROVED);
}

export async function reserveClinicalBudget(sb: RpcClient, kind: ClinicalKind) {
  let minute: { data: unknown; error: unknown }, daily: { data: unknown; error: unknown };
  try { minute = await sb.rpc('reserve_clinical_request'); } catch { throw new Error(BUDGET_UNAVAILABLE); }
  if (minute.error) throw new Error(BUDGET_UNAVAILABLE);
  if (minute.data !== true) throw new Error(MINUTE_EXHAUSTED);
  try { daily = await sb.rpc('reserve_clinical_budget', { _kind: kind }); } catch { throw new Error(BUDGET_UNAVAILABLE); }
  if (daily.error) {
    const msg = String((daily.error as { message?: string })?.message ?? '');
    throw new Error(msg.includes('not_approved') ? NOT_APPROVED : BUDGET_UNAVAILABLE);
  }
  if (typeof daily.data !== 'number' || daily.data < 0) throw new Error(DAILY_EXHAUSTED);
  return daily.data;
}

/** Runs prepare (ownership + complete input validation) and budget BEFORE the provider is touched. */
export async function gatedCall<P, R>(sb: RpcClient, kind: ClinicalKind, prepare: () => Promise<P>, provider: (prepared: P) => Promise<R>): Promise<R> {
  await requireClinicalAccess(sb);
  const prepared = await prepare();
  await reserveClinicalBudget(sb, kind);
  return provider(prepared);
}
