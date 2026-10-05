import { describe, expect, it } from 'vitest';
import { emptySections, type Session } from '@/lib/clinical';
import { DOC_SECTION_MAX, DOC_TOTAL_MAX, applyDocResult, canExportDoc, checkDocumentInput, demoProgress, documentEligibility, editDoc, isDocStale, presetPrompt, reportSnapshot, verifyDoc, sourceRevisions, invalidateDocs, type DemoDoc } from '@/lib/demo-scribe';
import { scenarioSession } from '@/lib/demo-scenarios';
import { applyEdit, applyVerify } from '@/lib/report-state';
import { z } from 'zod';
import { REPORT_STYLES, REPORT_TEMPLATES, DOC_KINDS } from '@/lib/demo-scribe';

const base = (): Session => ({ ...scenarioSession('bg', 'knee'), sections: emptySections() });
const reviewed = () => { let s = base(); s = applyEdit(s, 'anamneza', 'Болка в коляното.'); return applyVerify(s, 'anamneza', '2026-01-01T00:00:00Z'); };
const doc = (s: Session): DemoDoc => ({ kind: 'soap', language: 'bg', text: 'S: ...', verified_at: null, source: reportSnapshot(s), sourceRevs: sourceRevisions(s), rev: 1, createdAt: '' });

describe('presets allowlist', () => {
  it('rejects unsupported template/style values and changes prompt', () => {
    expect(z.enum(REPORT_TEMPLATES).safeParse('soap').success).toBe(false);
    expect(z.enum(REPORT_STYLES).safeParse('poem').success).toBe(false);
    expect(z.enum(DOC_KINDS).safeParse('discharge').success).toBe(false);
    expect(presetPrompt('msk', 'bullets')).not.toBe(presetPrompt('general', 'concise'));
  });
});
describe('document input budget', () => {
  const sec = (a: string) => ({ anamneza: a, status: '', izsledvania: '', terapia: '' });
  it('validates whole input', () => {
    expect(checkDocumentInput(sec(''))).toEqual({ ok: false, problem: 'empty' });
    expect(checkDocumentInput(sec('x'.repeat(DOC_SECTION_MAX + 1)))).toEqual({ ok: false, problem: 'segment' });
    const big = 'x'.repeat(DOC_SECTION_MAX);
    expect(DOC_TOTAL_MAX < big.length * 4).toBe(true);
    expect(checkDocumentInput({ anamneza: big, status: big, izsledvania: big, terapia: 'y' })).toEqual({ ok: false, problem: 'total' });
    expect(checkDocumentInput(sec('ok')).ok).toBe(true);
  });
});
describe('eligibility, staleness and edits', () => {
  it('requires all non-empty sections reviewed', () => {
    expect(documentEligibility(base())).toMatchObject({ ok: false, reason: 'empty' });
    let s = reviewed(); expect(documentEligibility(s).ok).toBe(true);
    s = applyEdit(s, 'status', 'Без оток.');
    expect(documentEligibility(s)).toMatchObject({ ok: false, reason: 'unreviewed', sections: ['status'] });
  });
  it('source edit makes document stale and blocks export', () => {
    const s = reviewed(); const d = doc(s);
    expect(canExportDoc(d, s)).toBe(true);
    const edited = applyVerify(applyEdit(s, 'anamneza', 'Променено.'), 'anamneza', 'x');
    expect(isDocStale(d, edited)).toBe(true);
    expect(canExportDoc(d, applyEdit(s, 'anamneza', 'Болка в коляното.'))).toBe(false); // unverified again
  });
  it('regression: verified doc -> source edit -> restore -> reverify stays stale/unverified', () => {
    const s0 = reviewed(); let docs = { soap: verifyDoc(doc(s0), 'now') };
    expect(canExportDoc(docs.soap, s0)).toBe(true);
    const edited = applyEdit(s0, 'anamneza', 'Друго.');
    docs = invalidateDocs(docs, edited).docs as typeof docs;
    expect(docs.soap.verified_at).toBeNull(); expect(docs.soap.text).toBe('S: ...');
    const restored = applyVerify(applyEdit(edited, 'anamneza', 'Болка в коляното.'), 'anamneza', 'x');
    docs = invalidateDocs(docs, restored).docs as typeof docs;
    expect(isDocStale(docs.soap, restored)).toBe(true);
    expect(canExportDoc(docs.soap, restored)).toBe(false);
    expect(docs.soap.verified_at).toBeNull();
    // Even without the invalidation pass, revision snapshot alone detects the restore.
    expect(isDocStale(verifyDoc(doc(s0), 'now'), restored)).toBe(true);
    // Regeneration from the new reviewed report clears staleness.
    const fresh = applyDocResult(docs, 'soap', docs.soap.rev, { ...doc(restored), invalidated: false });
    expect(fresh.applied).toBe(true); expect(isDocStale(fresh.docs.soap!, restored)).toBe(false);
  });
  it('document edit resets verification', () => {
    const d = verifyDoc(doc(reviewed()), 'now'); expect(d.verified_at).toBe('now');
    expect(editDoc(d, 'нов').verified_at).toBeNull();
  });
  it('late result is discarded if slot changed since start', () => {
    const s = reviewed(); const d = doc(s);
    const next = { ...d, text: 'нов' };
    expect(applyDocResult({}, 'soap', null, next).applied).toBe(true);
    expect(applyDocResult({ soap: editDoc(d, 'ръчно') }, 'soap', 1, next).applied).toBe(false);
    expect(applyDocResult({ soap: d }, 'soap', 1, next).docs.soap?.text).toBe('нов');
  });
  it('progress derives from state; scenarios are new sessions without identifiers', () => {
    const a = scenarioSession('en', 'cough'), b = scenarioSession('en', 'cough');
    expect(a.id).not.toBe(b.id); expect(a.patient_identifier).toBe('');
    expect(demoProgress(a, {})).toEqual({ conversation: true, report: false, review: false, documents: false });
    const s = reviewed(); expect(demoProgress(s, { soap: doc(s) }).documents).toBe(true);
  });
});
