// Shared, runtime-agnostic AI input budgets. Complete selected input is validated as a whole;
// nothing is ever sliced. Oversized input is rejected BEFORE quota consumption or provider calls.
export type BudgetSegment = { speaker: 'doctor' | 'patient'; speaker_id?: string | null | undefined; text: string };
export type InputBudget = { maxSegments: number; maxSegmentChars: number; maxTotalChars: number };
export type BudgetProblem = 'empty' | 'count' | 'segment' | 'total';

export const DEMO_REPORT_BUDGET: InputBudget = { maxSegments: 120, maxSegmentChars: 1500, maxTotalChars: 12000 };
export const DEMO_ASSISTANT_BUDGET: InputBudget = { maxSegments: 120, maxSegmentChars: 1500, maxTotalChars: 8000 };
export const CLINICAL_REPORT_BUDGET: InputBudget = { maxSegments: 400, maxSegmentChars: 4000, maxTotalChars: 24000 };
export const CLINICAL_ASSISTANT_BUDGET: InputBudget = { maxSegments: 400, maxSegmentChars: 4000, maxTotalChars: 16000 };
export const ASSISTANT_HISTORY_MESSAGES = 10;
export const ASSISTANT_HISTORY_CHARS = 8000;
export const QUESTION_MAX_CHARS = 1000;

export const lineOf = (s: BudgetSegment) =>
  `${s.speaker_id ? `Говорител ${s.speaker_id}` : s.speaker === 'doctor' ? 'Лекар' : 'Пациент'}: ${s.text}`;

export type BudgetResult = { ok: true; transcript: string } | { ok: false; problem: BudgetProblem };
export function checkBudget(segments: readonly BudgetSegment[], budget: InputBudget, allowEmpty = false): BudgetResult {
  if (!segments.length) return allowEmpty ? { ok: true, transcript: '' } : { ok: false, problem: 'empty' };
  if (segments.length > budget.maxSegments) return { ok: false, problem: 'count' };
  if (segments.some(s => s.text.length > budget.maxSegmentChars)) return { ok: false, problem: 'segment' };
  const transcript = segments.map(lineOf).join('\n');
  if (transcript.length > budget.maxTotalChars) return { ok: false, problem: 'total' };
  return { ok: true, transcript };
}

/** Bulgarian server message per problem; the client localizes by prefix (see i18n serverErrorsEn). */
export const budgetMessage = (p: BudgetProblem, b: InputBudget) => ({
  empty: 'Добавете текст към разговора преди генериране.',
  count: `Входът е твърде дълъг: повече от ${b.maxSegments} реплики. Нищо не е изпратено.`,
  segment: `Входът е твърде дълъг: реплика над ${b.maxSegmentChars} знака. Нищо не е изпратено.`,
  total: `Входът е твърде дълъг: общо над ${b.maxTotalChars} знака. Нищо не е изпратено.`,
})[p];

/** Throws before any provider/quota work when the complete input does not fit. */
export function buildTranscript(segments: readonly BudgetSegment[], budget: InputBudget, allowEmpty = false): string {
  const r = checkBudget(segments, budget, allowEmpty);
  if (!r.ok) throw new Error(budgetMessage(r.problem, budget));
  return r.transcript;
}

/** Newest N rows (fetched descending) returned in chronological order. */
export const newestChronological = <T>(rowsNewestFirst: readonly T[] | null | undefined, n: number): T[] =>
  (rowsNewestFirst ?? []).slice(0, n).reverse();
