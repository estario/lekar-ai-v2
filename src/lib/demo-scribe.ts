// Demo-only scribe extensions: report presets, derived documents and their pure state rules.
// Runtime-agnostic (used by the browser and by demo server functions). Never touches storage.
import { keys, type SectionKey, type Session } from './clinical';
import { snapshotRevisions } from './report-state';

export const REPORT_TEMPLATES = ['general', 'followup', 'msk'] as const;
export const REPORT_STYLES = ['concise', 'detailed', 'bullets'] as const;
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];
export type ReportStyle = (typeof REPORT_STYLES)[number];
export const DEFAULT_PRESET = { template: 'general' as ReportTemplate, style: 'concise' as ReportStyle };

/** Server prompt fragments; the 4-section schema never changes. */
export function presetPrompt(template: ReportTemplate, style: ReportStyle): string {
  const t = {
    general: 'Шаблон „обща консултация“: anamneza — повод, оплаквания, давност и изрично отречени симптоми; status — само реално описан преглед; izsledvania — само споменати изследвания/резултати; terapia — само обсъденият план.',
    followup: 'Шаблон „контролен преглед“: в anamneza подчертай промяната спрямо предходното състояние, придържане към терапията и нови оплаквания; в terapia — само реално договорените промени и следващ контрол.',
    msk: 'Шаблон „опорно-двигателен“: в anamneza — механизъм, локализация, характер, давност и отречени симптоми; в status — само реално описани оглед, палпация, обем на движение и тестове; не добавяй неописани тестове.',
  }[template];
  const s = {
    concise: 'Стил: кратък — сбити изречения, всеки раздел до 80 думи.',
    detailed: 'Стил: подробен — пълни изречения, всеки раздел до 160 думи, без добавяне на факти.',
    bullets: 'Стил: точки — всеки раздел като редове, започващи с „- “, до 8 реда.',
  }[style];
  return `${t} ${s}`;
}

export const DOC_KINDS = ['patient_summary', 'referral', 'soap'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LANGS = ['bg', 'en'] as const;
export type DocLang = (typeof DOC_LANGS)[number];
export const DOC_SECTION_MAX = 3000;
export const DOC_TOTAL_MAX = 9000;
export const DOC_OUTPUT_CAP = 2500;

export type DocSections = Record<SectionKey, string>;
export type DocInputProblem = 'empty' | 'segment' | 'total';
/** Whole-input check, run before quota/provider on both sides. Nothing is sliced. */
export function checkDocumentInput(sections: DocSections): { ok: true } | { ok: false; problem: DocInputProblem } {
  const values = keys.map(k => sections[k] ?? '');
  if (!values.some(v => v.trim())) return { ok: false, problem: 'empty' };
  if (values.some(v => v.length > DOC_SECTION_MAX)) return { ok: false, problem: 'segment' };
  if (values.reduce((n, v) => n + v.length, 0) > DOC_TOTAL_MAX) return { ok: false, problem: 'total' };
  return { ok: true };
}

export function documentPrompt(kind: DocKind, lang: DocLang): string {
  const nd = lang === 'en' ? 'Not documented' : 'Не е документирано';
  const base = `Създай ЧЕРНОВА документ САМО от предоставените прегледани раздели на отчета (ДЕМО, измислени данни). Не добавяй диагнози, лечение, съвети, изследвания, насочване или мотиви, които не са изрично в разделите. Запази несигурността и липсващите отговори точно както са в разделите — не превръщай неизяснено или неотговорено в отречено или установено. Всяко поле без данни попълни с „${nd}“. Без markdown заглавия с #; използвай прости заглавия на отделни редове.`;
  const k = {
    patient_summary: 'Вид: разбираемо резюме за пациента с полета: Какво обсъдихме; Какво беше установено; Следващи стъпки (само документираните). Прост език.',
    referral: `Вид: чернова на направление с полета: До (специалист/звено); Причина за насочване; Анамнеза; Обективно състояние; Изследвания; Досегашна терапия. Ако дестинацията или причината не са изрично в разделите, напиши „${nd}“.`,
    soap: 'Вид: SOAP бележка с полета S (Subjective), O (Objective), A (Assessment), P (Plan). A попълни само ако оценка/диагноза е изрично записана; иначе „' + nd + '“.',
  }[kind];
  const l = lang === 'en' ? ' Write the whole document in English.' : ' Пиши целия документ на български.';
  return `${base} ${k}${l}`;
}

export type DemoDoc = { kind: DocKind; language: DocLang; text: string; verified_at: string | null; source: DocSections; sourceRevs: Record<SectionKey, number>; invalidated?: boolean; rev: number; createdAt: string };
export type SessionDocs = Partial<Record<DocKind, DemoDoc>>;

export const reportSnapshot = (s: Pick<Session, 'sections'>): DocSections =>
  Object.fromEntries(keys.map(k => [k, s.sections[k].content])) as DocSections;

export type Eligibility = { ok: true } | { ok: false; reason: 'empty' | 'unreviewed'; sections: SectionKey[] };
/** All non-empty report sections must be physician-reviewed; at least one must be non-empty. */
export function documentEligibility(s: Pick<Session, 'sections'>): Eligibility {
  const filled = keys.filter(k => s.sections[k].content.trim());
  if (!filled.length) return { ok: false, reason: 'empty', sections: [] };
  const pending = filled.filter(k => !s.sections[k].verified_at);
  return pending.length ? { ok: false, reason: 'unreviewed', sections: pending } : { ok: true };
}

/** Stale when the source report changed or is no longer fully reviewed since generation. */
type SourceLike = Pick<Session, 'sections' | 'revisions'>;
/** Source changed since generation: content OR section revision (edit/verify) differs. */
export const sourceChanged = (doc: DemoDoc, s: SourceLike) =>
  keys.some(k => (doc.source[k] ?? '') !== s.sections[k].content || (doc.sourceRevs?.[k] ?? -1) !== (s.revisions?.[k] ?? 0));
/** Sticky: once the source changed, the document stays stale until regenerated, even if text is restored. */
export function isDocStale(doc: DemoDoc, s: SourceLike): boolean {
  return !!doc.invalidated || sourceChanged(doc, s) || !documentEligibility(s).ok;
}
/** Marks every document whose source changed as invalidated and clears its review; keeps draft text. */
export function invalidateDocs(docs: SessionDocs, s: SourceLike): { docs: SessionDocs; changed: boolean } {
  let changed = false; const next: SessionDocs = { ...docs };
  for (const k of Object.keys(docs) as DocKind[]) {
    const d = docs[k]; if (!d || d.invalidated) continue;
    if (sourceChanged(d, s) || !documentEligibility(s).ok) { next[k] = { ...d, invalidated: true, verified_at: null }; changed = true; }
  }
  return { docs: changed ? next : docs, changed };
}
export const sourceRevisions = (s: Pick<Session, 'sections' | 'revisions'>) => snapshotRevisions(s);
export const canExportDoc = (doc: DemoDoc, s: SourceLike) => !isDocStale(doc, s);

export const editDoc = (doc: DemoDoc, text: string): DemoDoc => ({ ...doc, text, verified_at: null, rev: doc.rev + 1 });
export const verifyDoc = (doc: DemoDoc, stamp: string | null): DemoDoc => ({ ...doc, verified_at: stamp, rev: doc.rev + 1 });

/** Applies a late generation result only if the slot was not edited/replaced after the request started. */
export function applyDocResult(docs: SessionDocs, kind: DocKind, startRev: number | null, next: Omit<DemoDoc, 'rev'>): { docs: SessionDocs; applied: boolean } {
  // A fresh generation clears staleness (invalidated stays false on the new snapshot).
  const cur = docs[kind];
  const curRev = cur ? cur.rev : null;
  if (curRev !== startRev) return { docs, applied: false };
  return { docs: { ...docs, [kind]: { ...next, rev: (curRev ?? 0) + 1 } }, applied: true };
}

export type Progress = { conversation: boolean; report: boolean; review: boolean; documents: boolean };
export function demoProgress(s: Pick<Session, 'sections' | 'segments' | 'revisions'>, docs: SessionDocs | undefined): Progress {
  const report = keys.some(k => s.sections[k].content.trim());
  const review = documentEligibility(s).ok;
  return { conversation: s.segments.length > 0, report, review, documents: Object.values(docs ?? {}).some(d => d && !isDocStale(d, s)) };
}
