// Pure report-section state transitions: per-section revisions, tracked voice-phrase insertions,
// orphaning on edits, exact-range Undo and guarded merge of AI-generated drafts.
import { keys, type SectionExpansion, type SectionKey, type Session } from './clinical';

type SessionLike = Pick<Session, 'sections'> & { expansions?: SectionExpansion[]; revisions?: Partial<Record<SectionKey, number>>; edited?: Partial<Record<SectionKey, boolean>> };

export const revisionOf = (s: SessionLike, k: SectionKey) => s.revisions?.[k] ?? 0;
export const snapshotRevisions = (s: SessionLike) => Object.fromEntries(keys.map(k => [k, revisionOf(s, k)])) as Record<SectionKey, number>;
const bump = (s: SessionLike, k: SectionKey) => ({ ...(s.revisions ?? {}), [k]: revisionOf(s, k) + 1 });
export const isActive = (e: SectionExpansion) => e.status !== 'orphaned';

/** Appends text on its own line; returns new content plus exact range (start of text, separator length). */
export function appendTracked(content: string, text: string) {
  const base = content.trim() ? content.replace(/\s+$/, '') : '';
  const sep = base ? 1 : 0;
  return { content: base + (sep ? '\n' : '') + text, start: base.length + sep, sep };
}

/** Shift tracked ranges across an arbitrary edit; ranges overlapped by the edited region become orphaned. */
export function shiftRanges(oldText: string, newText: string, exps: readonly SectionExpansion[], section: SectionKey): SectionExpansion[] {
  let p = 0; while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
  let sfx = 0; while (sfx < oldText.length - p && sfx < newText.length - p && oldText[oldText.length - 1 - sfx] === newText[newText.length - 1 - sfx]) sfx++;
  const oldEnd = oldText.length - sfx, delta = newText.length - oldText.length;
  return exps.map(e => {
    if (e.section !== section || !isActive(e) || e.start === undefined) return e;
    const a = e.start - (e.sep ?? 0), b = e.start + e.text.length;
    if (oldText === newText || b <= p) return e;
    if (a >= oldEnd) return { ...e, start: e.start + delta };
    return { ...e, status: 'orphaned' as const };
  });
}

/** Manual edit: bumps revision, marks edited, resets verification, orphans touched insertions. */
export function applyEdit<T extends SessionLike>(s: T, k: SectionKey, content: string): T {
  const old = s.sections[k].content;
  return { ...s, sections: { ...s.sections, [k]: { content, verified_at: null } }, revisions: bump(s, k), edited: { ...(s.edited ?? {}), [k]: true }, expansions: shiftRanges(old, content, s.expansions ?? [], k) };
}

export function applyVerify<T extends SessionLike>(s: T, k: SectionKey, stamp: string | null): T {
  return { ...s, sections: { ...s.sections, [k]: { ...s.sections[k], verified_at: stamp } }, revisions: bump(s, k) };
}

/** Inserts a tracked expansion (idempotent per sourceKey); does not bump the manual revision. */
export function insertTracked<T extends SessionLike>(s: T, e: Omit<SectionExpansion, 'start' | 'sep' | 'status'>): T {
  if ((s.expansions ?? []).some(x => x.sourceKey === e.sourceKey)) return s;
  const r = appendTracked(s.sections[e.section].content, e.text);
  return { ...s, sections: { ...s.sections, [e.section]: { content: r.content, verified_at: null } }, expansions: [...(s.expansions ?? []), { ...e, start: r.start, sep: r.sep, status: 'active' }] };
}

export type UndoResult<T> = { session: T; ok: true; removed: SectionExpansion } | { session: T; ok: false; reason: 'none' | 'changed' };
/** Removes only the latest ACTIVE insertion if its exact range is untouched; otherwise orphans it and refuses. */
export function undoLatest<T extends SessionLike>(s: T): UndoResult<T> {
  const list = s.expansions ?? [];
  let idx = -1; for (let i = list.length - 1; i >= 0; i--) if (isActive(list[i]!)) { idx = i; break; }
  if (idx < 0) return { session: s, ok: false, reason: 'none' };
  const e = list[idx]!, content = s.sections[e.section].content, sep = e.sep ?? 0;
  const intact = e.start !== undefined && content.slice(e.start, e.start + e.text.length) === e.text && (!sep || content[e.start - 1] === '\n');
  if (!intact) return { session: { ...s, expansions: list.map((x, i) => i === idx ? { ...x, status: 'orphaned' as const } : x) }, ok: false, reason: 'changed' };
  const from = e.start! - sep, to = e.start! + e.text.length;
  const next = content.slice(0, from) + content.slice(to);
  const others = list.filter((_, i) => i !== idx).map(x => x.section === e.section && isActive(x) && x.start !== undefined && x.start - (x.sep ?? 0) >= to ? { ...x, start: x.start - (to - from) } : x);
  return { session: { ...s, sections: { ...s.sections, [e.section]: { content: next, verified_at: null } }, expansions: others }, ok: true, removed: e };
}

/** Sections whose content would be lost on replace: non-empty and physician-verified or manually edited. */
export const protectedSections = (s: SessionLike) => keys.filter(k => s.sections[k].content.trim() && (s.sections[k].verified_at || s.edited?.[k]));

export type MergeResult<T> = { session: T; replaced: SectionKey[]; skipped: SectionKey[] };
/**
 * Applies a generated draft against the LATEST state: sections edited/verified after the request
 * started (revision changed) or explicitly kept are never touched. Replaced sections get the draft
 * plus every active insertion re-appended in order (repeated cues stay separate, undoable copies);
 * orphaned insertions in replaced sections are dropped, never resurrected.
 */
export function mergeGenerated<T extends SessionLike>(s: T, draft: Record<SectionKey, string>, startRevs: Record<SectionKey, number>, keep: ReadonlySet<SectionKey>): MergeResult<T> {
  const sections = { ...s.sections }; let exps = [...(s.expansions ?? [])]; const replaced: SectionKey[] = [], skipped: SectionKey[] = [];
  const edited = { ...(s.edited ?? {}) };
  for (const k of keys) {
    if (keep.has(k) || revisionOf(s, k) !== startRevs[k]) { skipped.push(k); continue; }
    let content = draft[k] ?? '';
    exps = exps.filter(e => e.section !== k || isActive(e)).map(e => {
      if (e.section !== k) return e;
      const r = appendTracked(content, e.text); content = r.content; return { ...e, start: r.start, sep: r.sep };
    });
    sections[k] = { content, verified_at: null }; edited[k] = false; replaced.push(k);
  }
  return { session: { ...s, sections, expansions: exps, edited }, replaced, skipped };
}

/** Transcript lines that carry observed evidence (macro commands are excluded from every AI input). */
export const evidenceSegments = <S extends { id: string; command?: unknown }>(segments: readonly S[], expansions?: readonly SectionExpansion[]) => {
  const legacy = new Set((expansions ?? []).map(e => e.segmentId).filter(Boolean));
  return segments.filter(x => !x.command && !legacy.has(x.id));
};

/** Inserts a segment keeping persisted client sequence order (late completions cannot reorder). */
export function insertBySeq<S extends { seq?: number | null }>(list: readonly S[], seg: S): S[] {
  if (seg.seq == null) return [...list, seg];
  let i = list.length; while (i > 0 && (list[i - 1]!.seq ?? -Infinity) > seg.seq) i--;
  return [...list.slice(0, i), seg, ...list.slice(i)];
}
