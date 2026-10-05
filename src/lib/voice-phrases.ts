import type { SectionKey } from './clinical';
import type { Language } from './i18n';

// Demo-only deterministic voice phrases: a whole finalized doctor utterance that equals a trigger
// inserts a preconfigured paragraph. Lives in browser memory only; no AI involved.
export type VoicePhrase = { id: string; trigger: string; expansion: string; section: SectionKey; language: Language; enabled: boolean };
import type { SectionExpansion } from './clinical';
import { evidenceSegments, insertTracked } from './report-state';
export type Expansion = SectionExpansion;

export function normalizeUtterance(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}]+$/u, '')
    .replace(/^[\s\p{P}]+/u, '')
    .replace(/\s*[,;\u2013\u2014]\s*/gu, ' ') // speech pauses transcribed as commas/dashes inside the cue
    .replace(/\s+/gu, ' ')
    .trim();
}

export function matchPhrase(utterance: string, phrases: readonly VoicePhrase[], language: Language): VoicePhrase | null {
  const said = normalizeUtterance(utterance);
  if (!said) return null;
  return phrases.find(p => p.enabled && p.language === language && p.expansion.trim() && normalizeUtterance(p.trigger) === said) ?? null;
}

export type PhraseProblem = 'empty' | 'emptyText' | 'duplicate' | null;
export function validatePhrase(draft: Pick<VoicePhrase, 'id' | 'trigger' | 'expansion' | 'language'>, all: readonly VoicePhrase[]): PhraseProblem {
  const key = normalizeUtterance(draft.trigger);
  if (!key) return 'empty';
  if (all.some(p => p.id !== draft.id && p.language === draft.language && normalizeUtterance(p.trigger) === key)) return 'duplicate';
  if (!draft.expansion.trim()) return 'emptyText';
  return null;
}

export const defaultVoicePhrases = (): VoicePhrase[] => [
  { id: crypto.randomUUID(), trigger: 'корем нормален', expansion: 'Коремът е мек и неболезнен. Чревната перисталтика е нормална във всички четири квадранта. Не се палпират патологични формации. Без хепатоспленомегалия.', section: 'status', language: 'bg', enabled: true },
  { id: crypto.randomUUID(), trigger: 'abdomen normal', expansion: 'Soft and non-tender, normal bowel sounds in all four quadrants, no palpable masses. No hepatosplenomegaly.', section: 'status', language: 'en', enabled: true },
];

export const insertExpansion = (content: string, text: string) => content.trim() ? `${content.replace(/\s+$/, '')}\n${text}` : text;

/** Removes the last exact occurrence of an inserted expansion; null when the user has edited it away. */
export function removeExpansion(content: string, text: string): string | null {
  const at = content.lastIndexOf(text);
  if (at < 0) return null;
  let before = content.slice(0, at);
  const after = content.slice(at + text.length);
  if (before.endsWith('\n') && (after === '' || after.startsWith('\n'))) before = before.slice(0, -1);
  return before + after;
}

/** After AI regeneration, re-append recorded expansions that the new draft lacks (never duplicates). */
export function reapplyExpansions(report: Record<SectionKey, string>, expansions: readonly Expansion[] | undefined): Record<SectionKey, string> {
  const out = { ...report };
  for (const e of expansions ?? []) if (!out[e.section].includes(e.text)) out[e.section] = insertExpansion(out[e.section], e.text);
  return out;
}

type ExpansionTarget = { sections: Record<SectionKey, { content: string; verified_at: string | null }>; expansions?: Expansion[] };
/** Pure, idempotent per sourceKey: a repeated callback/finalization for the same source never inserts twice. Tracks exact range. */
export function applyExpansionTo<T extends ExpansionTarget>(s: T, sourceKey: string, cue: string, p: VoicePhrase, opts: { id: string; at: string; manual: boolean; segmentId: string | null }): T {
  return insertTracked(s, { id: opts.id, sourceKey, phraseId: p.id, cue: cue.trim(), text: p.expansion.trim(), section: p.section, at: opts.at, manual: opts.manual, segmentId: opts.segmentId });
}

/** Command-only segments (persisted command identity, or legacy expansion link) never reach AI input. */
export const withoutCueSegments = evidenceSegments;

export type FinalToken = { text: string; is_final?: boolean | undefined; speaker?: string | undefined };
/**
 * Collects Soniox final tokens into utterances. Soniox delivers each final token exactly once
 * (no end_ms filtering, so equal-time punctuation survives). Each flushed utterance gets a stable
 * key `<runId>:<n>`; flushing again (repeated endpoint/finish) returns nothing, while a later
 * genuine repetition becomes a new utterance with a new key.
 */
export class FinalUtteranceBuffer {
  private parts: { speakerId: string | undefined; text: string }[] = [];
  private n = 0;
  constructor(readonly runId: string) {}
  add(tokens: readonly FinalToken[], diarize: boolean) {
    for (const t of tokens) {
      if (!t.is_final) continue;
      const speakerId = diarize ? t.speaker : undefined;
      const last = this.parts.at(-1);
      if (last && last.speakerId === speakerId) last.text += t.text; else this.parts.push({ speakerId, text: t.text });
    }
  }
  flush() {
    return this.parts.splice(0).filter(p => p.text.trim()).map(p => ({ key: `${this.runId}:${this.n++}`, speakerId: p.speakerId, text: p.text.trim() }));
  }
}
