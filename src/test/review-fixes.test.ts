import { describe, expect, it, vi } from 'vitest';
import { gatedCall, requireClinicalAccess, NOT_APPROVED, DAILY_EXHAUSTED, type RpcClient } from '@/lib/clinical-gate';
import { buildTranscript, checkBudget, DEMO_REPORT_BUDGET, newestChronological } from '@/lib/ai-input';
import { applyEdit, applyVerify, evidenceSegments, insertBySeq, mergeGenerated, protectedSections, snapshotRevisions, undoLatest } from '@/lib/report-state';
import { applyExpansionTo, defaultVoicePhrases } from '@/lib/voice-phrases';
import { RecordingLifecycle, providerTimeExceeded } from '@/lib/recording-lifecycle';
import { emptySections, type Session } from '@/lib/clinical';

const fakeRpc = (map: Record<string, { data?: unknown; error?: unknown } | Error>): RpcClient => ({
  rpc: async (fn: string) => { const r = map[fn]; if (r instanceof Error) throw r; return { data: r?.data ?? null, error: r?.error ?? null }; },
});

describe('clinical gate: permission before provider', () => {
  it('denies unapproved, missing-role and lookup errors before prepare/provider', async () => {
    for (const sb of [fakeRpc({ is_clinical_user: { data: false } }), fakeRpc({ is_clinical_user: { error: { message: 'x' } } }), fakeRpc({ is_clinical_user: new Error('net') }), fakeRpc({})]) {
      const prepare = vi.fn(async () => 1), provider = vi.fn(async () => 2);
      await expect(gatedCall(sb, 'report', prepare, provider)).rejects.toThrow(NOT_APPROVED);
      expect(prepare).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
    }
  });
  it('daily budget exhaustion and invalid input stop before provider', async () => {
    const provider = vi.fn(async () => 'x');
    await expect(gatedCall(fakeRpc({ is_clinical_user: { data: true }, reserve_clinical_request: { data: true }, reserve_clinical_budget: { data: -1 } }), 'assistant', async () => 1, provider)).rejects.toThrow(DAILY_EXHAUSTED);
    const budget = vi.fn();
    const sb: RpcClient = { rpc: async (fn: string) => { if (fn !== 'is_clinical_user') budget(fn); return { data: true, error: null }; } };
    await expect(gatedCall(sb, 'report', async () => buildTranscript([{ speaker: 'doctor', text: 'x'.repeat(2000) }], DEMO_REPORT_BUDGET), provider)).rejects.toThrow(/твърде дълъг/);
    expect(budget).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
    await expect(requireClinicalAccess(fakeRpc({ is_clinical_user: { data: true } }))).resolves.toBeUndefined();
  });
});

describe('complete input budget validation', () => {
  const seg = (text: string) => ({ speaker: 'doctor' as const, text });
  it('rejects instead of slicing', () => {
    expect(checkBudget(Array.from({ length: 121 }, () => seg('a')), DEMO_REPORT_BUDGET)).toEqual({ ok: false, problem: 'count' });
    expect(checkBudget([seg('a'.repeat(1501))], DEMO_REPORT_BUDGET)).toEqual({ ok: false, problem: 'segment' });
    expect(checkBudget(Array.from({ length: 10 }, () => seg('a'.repeat(1400))), DEMO_REPORT_BUDGET)).toEqual({ ok: false, problem: 'total' });
    const ok = checkBudget([seg('първа'), seg('последна')], DEMO_REPORT_BUDGET);
    expect(ok.ok && ok.transcript).toBe('Лекар: първа\nЛекар: последна');
  });
});

const bgP = defaultVoicePhrases().find(p => p.language === 'bg')!;
const base = (): Session => ({ id: 's', patient_name: '', patient_identifier: '', patient_age: null, patient_sex: null, mode: 'dictation', status: 'draft', consent_at: null, duration_seconds: 0, patient_instructions: '', created_at: '', segments: [], sections: emptySections() });
const cue = (s: Session, key: string, segId: string | null = null) => applyExpansionTo(s, key, 'корем нормален', bgP, { id: key, at: '', manual: false, segmentId: segId });
const draft = { anamneza: 'A', status: 'Нов статус.', izsledvania: '', terapia: '' };

describe('commands vs evidence', () => {
  it('Undo then regenerate never sends the command to AI (report and assistant share the filter)', () => {
    let s = base();
    s = { ...s, segments: [{ id: 'e', speaker: 'patient', text: 'Боли', seconds: 0 }, { id: 'c', speaker: 'doctor', text: 'корем нормален', seconds: 1, command: { phraseId: bgP.id, cue: 'корем нормален' } }] };
    s = cue(s, 'k1', 'c');
    const u = undoLatest(s); expect(u.ok).toBe(true);
    expect(u.session.expansions).toHaveLength(0);
    expect(evidenceSegments(u.session.segments, u.session.expansions).map(x => x.id)).toEqual(['e']);
  });
});

describe('insertion tracking, Undo and regeneration', () => {
  it('manual correction of a preset is not resurrected on generate', () => {
    let s = cue(base(), 'k1');
    s = applyEdit(s, 'status', s.sections.status.content.replace('мек', 'твърд'));
    expect(s.expansions![0]!.status).toBe('orphaned');
    const m = mergeGenerated(s, draft, snapshotRevisions(s), new Set());
    expect(m.session.sections.status.content).toBe('Нов статус.');
    expect(m.session.expansions).toHaveLength(0);
  });
  it('refuses Undo when the original was edited and an unrelated later copy exists', () => {
    let s = cue({ ...base(), sections: { ...emptySections(), status: { content: 'Бележка', verified_at: null } } }, 'k1');
    const edited = s.sections.status.content.replace('Коремът', 'Корем') + `\nЦитат: "${bgP.expansion}"`;
    s = applyEdit(s, 'status', edited);
    const u = undoLatest(s);
    expect(u.ok).toBe(false);
    expect(u.session.sections.status.content).toBe(edited);
  });
  it('edits before an insertion shift its range and Undo still removes exactly it', () => {
    let s = cue({ ...base(), sections: { ...emptySections(), status: { content: 'Бележка', verified_at: null } } }, 'k1');
    s = applyEdit(s, 'status', 'Дълга нова ' + s.sections.status.content);
    const u = undoLatest(s); expect(u.ok).toBe(true);
    expect(u.session.sections.status.content).toBe('Дълга нова Бележка');
  });
  it('two repeated cues stay two copies after regeneration and both can be undone', () => {
    let s = cue(cue(base(), 'k1'), 'k2');
    s = mergeGenerated(s, draft, snapshotRevisions(s), new Set()).session;
    expect(s.sections.status.content.split(bgP.expansion).length - 1).toBe(2);
    const u1 = undoLatest(s); expect(u1.ok).toBe(true);
    const u2 = undoLatest(u1.session); expect(u2.ok).toBe(true);
    expect(u2.session.sections.status.content).toBe('Нов статус.');
  });
  it('an orphaned entry does not block Undo of an earlier intact one', () => {
    let s = cue(base(), 'k1');
    s = cue({ ...s, sections: { ...s.sections, anamneza: s.sections.anamneza } }, 'k2');
    const end = s.sections.status.content.length;
    s = applyEdit(s, 'status', s.sections.status.content.slice(0, end - 3));
    expect(s.expansions!.map(e => e.status)).toEqual(['active', 'orphaned']);
    const u = undoLatest(s);
    expect(u.ok && u.removed.id).toBe('k1');
    expect(u.session.sections.status.content.startsWith(bgP.expansion)).toBe(false);
  });
  it('edits during a pending generation are never overwritten; verification resets only for replaced sections', () => {
    let s: Session = { ...base(), sections: { ...emptySections(), izsledvania: { content: 'Проверено', verified_at: 'x' } } };
    const start = snapshotRevisions(s);
    s = applyEdit(s, 'anamneza', 'Редакция по време на генериране');
    const keep = new Set(protectedSections(s).filter(k => k === 'izsledvania'));
    const m = mergeGenerated(s, draft, start, keep);
    expect(m.session.sections.anamneza.content).toBe('Редакция по време на генериране');
    expect(m.session.sections.izsledvania).toEqual({ content: 'Проверено', verified_at: 'x' });
    expect(m.replaced).toEqual(['status', 'terapia']);
    const v = applyVerify(m.session, 'status', 'now');
    expect(mergeGenerated(v, draft, start, new Set()).skipped).toContain('status');
  });
});

describe('recording lifecycle', () => {
  it('sign-out teardown cancels the recorder, clears timers and invalidates late callbacks', () => {
    const cleared: unknown[] = []; const lc = new RecordingLifecycle(h => cleared.push(h));
    const gen = lc.begin('s1'); const rec = { cancel: vi.fn() };
    expect(lc.attach(gen, rec)).toBe(true);
    const h = lc.addTimer(1 as unknown as ReturnType<typeof setInterval>);
    lc.teardown();
    expect(rec.cancel).toHaveBeenCalledOnce(); expect(cleared).toContain(h);
    expect(lc.isCurrent(gen)).toBe(false); expect(lc.active).toBe(false);
    const late = { cancel: vi.fn() }; expect(lc.attach(gen, late)).toBe(false); expect(late.cancel).toHaveBeenCalled();
  });
  it('provider wall clock counts pauses', () => {
    expect(providerTimeExceeded(1000, 1000 + 297_999, 300)).toBe(false);
    expect(providerTimeExceeded(1000, 1000 + 298_000, 300)).toBe(true);
    expect(providerTimeExceeded(0, 10 ** 9, 300)).toBe(false);
  });
});

describe('ordering and history', () => {
  it('a late-completing earlier line is placed by its sequence', () => {
    const l = insertBySeq(insertBySeq([], { id: 'b', seq: 2 }), { id: 'a', seq: 1 });
    expect(l.map(x => x.id)).toEqual(['a', 'b']);
  });
  it('assistant history takes newest 30 in chronological order', () => {
    const desc = Array.from({ length: 40 }, (_, i) => 40 - i);
    expect(newestChronological(desc, 30)).toEqual(Array.from({ length: 30 }, (_, i) => 11 + i));
  });
});
