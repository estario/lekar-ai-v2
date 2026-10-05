import { describe, expect, it } from 'vitest';
import { defaultVoicePhrases, insertExpansion, matchPhrase, normalizeUtterance, reapplyExpansions, removeExpansion, validatePhrase, type Expansion, type VoicePhrase } from '@/lib/voice-phrases';
import { ui } from '@/lib/i18n';

const phrases = defaultVoicePhrases();
const bgP = phrases.find(p => p.language === 'bg')!;
const enP = phrases.find(p => p.language === 'en')!;

describe('voice phrase matcher', () => {
  it('matches whole utterances case/punctuation/whitespace-insensitively incl. Bulgarian', () => {
    expect(matchPhrase('Корем нормален.', phrases, 'bg')).toBe(bgP);
    expect(matchPhrase('  КОРЕМ   нормален!  ', phrases, 'bg')).toBe(bgP);
    expect(matchPhrase('Abdomen normal?', phrases, 'en')).toBe(enP);
    expect(normalizeUtterance('Корем\u00a0нормален…')).toBe('корем нормален');
    expect(matchPhrase('Корем, нормален.', phrases, 'bg')).toBe(bgP);
    expect(matchPhrase('Не, корем нормален.', phrases, 'bg')).toBeNull();
  });
  it('rejects substrings, negation, longer descriptions and wrong language', () => {
    for (const s of ['не корем нормален', 'корем нормален ли е', 'Коремът ми не е нормален, боли', 'корем']) expect(matchPhrase(s, phrases, 'bg')).toBeNull();
    for (const s of ['not abdomen normal', 'abdomen normal today', 'my abdomen normally hurts']) expect(matchPhrase(s, phrases, 'en')).toBeNull();
    expect(matchPhrase('abdomen normal', phrases, 'bg')).toBeNull();
    expect(matchPhrase('корем нормален', phrases, 'en')).toBeNull();
  });
  it('ignores disabled phrases', () => {
    const off: VoicePhrase[] = phrases.map(p => ({ ...p, enabled: false }));
    expect(matchPhrase('корем нормален', off, 'bg')).toBeNull();
  });
  it('validates empty and duplicate normalized triggers within one language', () => {
    expect(validatePhrase({ id: 'x', trigger: '  ', expansion: 'a', language: 'bg' }, phrases)).toBe('empty');
    expect(validatePhrase({ id: 'x', trigger: 'Корем нормален.', expansion: 'a', language: 'bg' }, phrases)).toBe('duplicate');
    expect(validatePhrase({ id: 'x', trigger: 'корем нормален', expansion: 'a', language: 'en' }, phrases)).toBeNull();
    expect(validatePhrase({ id: 'x', trigger: 'нещо', expansion: ' ', language: 'bg' }, phrases)).toBe('emptyText');
    expect(validatePhrase(bgP, phrases)).toBeNull();
  });
});

describe('expansion insertion, undo and regeneration', () => {
  it('preserves existing text and undoes only the inserted paragraph', () => {
    const inserted = insertExpansion('Ръчна бележка.', bgP.expansion);
    expect(inserted).toBe(`Ръчна бележка.\n${bgP.expansion}`);
    const edited = inserted + '\nОще една ръчна бележка.';
    expect(removeExpansion(edited, bgP.expansion)).toBe('Ръчна бележка.\nОще една ръчна бележка.');
    expect(removeExpansion('Различен текст', bgP.expansion)).toBeNull();
    expect(removeExpansion(insertExpansion('', bgP.expansion), bgP.expansion)).toBe('');
  });
  it('re-applies recorded expansions after AI regeneration without duplicating', () => {
    const e: Expansion = { id: '1', sourceKey: 'seg:1', phraseId: bgP.id, cue: 'корем нормален', text: bgP.expansion, section: 'status', at: '', manual: false };
    const report = { anamneza: 'A', status: 'Нов статус.', izsledvania: '', terapia: '' };
    const once = reapplyExpansions(report, [e]);
    expect(once.status).toBe(`Нов статус.\n${bgP.expansion}`);
    expect(reapplyExpansions(once, [e]).status).toBe(once.status);
    expect(once.anamneza).toBe('A');
  });
  it('later template edits do not change recorded text', () => {
    const e: Expansion = { id: '1', sourceKey: 'seg:1', phraseId: bgP.id, cue: 'x', text: bgP.expansion, section: 'status', at: '', manual: false };
    const changed = { ...bgP, expansion: 'Друго' };
    expect(changed.expansion).not.toBe(e.text);
    expect(reapplyExpansions({ anamneza: '', status: '', izsledvania: '', terapia: '' }, [e]).status).toBe(bgP.expansion);
  });
  it('has bilingual UI strings', () => {
    expect(ui.en.vpTitle).toBe('Voice phrases');
    expect(ui.bg.vpTitle).toBe('Гласови фрази');
  });
});

import { applyExpansionTo, FinalUtteranceBuffer, withoutCueSegments } from '@/lib/voice-phrases';
import { emptySections } from '@/lib/clinical';

describe('recording identity and idempotence', () => {
  it('keeps equal-time punctuation, flush is idempotent, later repetition gets a new key', () => {
    const b = new FinalUtteranceBuffer('run1');
    b.add([{ text: 'Корем', is_final: true }, { text: ' норм', is_final: false }], false);
    b.add([{ text: ' нормален', is_final: true }, { text: '.', is_final: true }], false);
    const first = b.flush();
    expect(first).toEqual([{ key: 'run1:0', speakerId: undefined, text: 'Корем нормален.' }]);
    expect(b.flush()).toEqual([]); // repeated endpoint / finish
    b.add([{ text: 'Корем нормален.', is_final: true }], false);
    expect(b.flush()[0]?.key).toBe('run1:1');
  });
  it('interim-only results produce no utterance', () => {
    const b = new FinalUtteranceBuffer('r');
    b.add([{ text: 'корем нормален', is_final: false }], false);
    expect(b.flush()).toEqual([]);
  });
  it('repeated final callback with the same source key inserts once and marks unverified', () => {
    const s0 = { sections: { ...emptySections(), status: { content: 'Бележка', verified_at: '2026-01-01' } }, expansions: [] };
    const o = { id: 'e', at: 'now', manual: false, segmentId: 'seg1' };
    const s1 = applyExpansionTo(s0, 'rec:run1:0', 'корем нормален', bgP, o);
    const s2 = applyExpansionTo(s1, 'rec:run1:0', 'корем нормален', bgP, o);
    expect(s2).toBe(s1);
    expect(s1.sections.status.content.split(bgP.expansion).length).toBe(2);
    expect(s1.sections.status.verified_at).toBeNull();
    expect(applyExpansionTo(s1, 'rec:run1:1', 'корем нормален', bgP, o).expansions).toHaveLength(2);
  });
  it('excludes cue-only segments from AI input', () => {
    const segs = [{ id: 'a' }, { id: 'cue' }];
    expect(withoutCueSegments(segs, [{ id: '1', sourceKey: 'k', phraseId: 'p', cue: 'x', text: 't', section: 'status', at: '', manual: false, segmentId: 'cue' }])).toEqual([{ id: 'a' }]);
  });
});

