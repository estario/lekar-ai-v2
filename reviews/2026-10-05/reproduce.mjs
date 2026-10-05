// Review evidence, not a regression suite or application fix.
// Run from repository root: bun reviews/2026-10-05/reproduce.mjs
// Assertions confirm current defects; a corrected application should change these expectations.
// No network, credentials, database, or microphone access.
import assert from 'node:assert/strict';
import { applyExpansionTo, withoutCueSegments, reapplyExpansions, removeExpansion } from '../../src/lib/voice-phrases.ts';
import { emptySections } from '../../src/lib/clinical.ts';
import { reserveQuota } from '../../src/lib/demo-token.ts';

const phrase = { id: 'phrase', trigger: 'abdomen normal', expansion: 'Soft and non-tender.', section: 'status', language: 'en', enabled: true };
const segments = [{ id: 'cue', text: phrase.trigger }, { id: 'clinical', text: 'Abdominal pain.' }];
const options = id => ({ id, at: '2026-10-05T18:00:00Z', manual: false, segmentId: 'cue' });
const inserted = applyExpansionTo({ sections: emptySections(), expansions: [] }, 'source-1', phrase.trigger, phrase, options('expansion-1'));
const blankReport = () => ({ anamneza: '', status: '', izsledvania: '', terapia: '' });

assert.deepEqual(withoutCueSegments(segments, inserted.expansions).map(s => s.id), ['clinical']);
// Mirror index.tsx:64's successful Undo: text removed and audit entry deleted.
const afterUndo = { ...inserted, sections: { ...inserted.sections, status: { content: removeExpansion(inserted.sections.status.content, phrase.expansion), verified_at: null } }, expansions: [] };
assert.deepEqual(withoutCueSegments(segments, afterUndo.expansions).map(s => s.id), ['cue', 'clinical']);
console.log('CONFIRMED: Undo returns a pure command segment to the next report AI input.');

// Mirror editSection:58: content changes, expansion metadata remains.
const edited = { ...inserted, sections: { ...inserted.sections, status: { content: 'Tender abdomen.', verified_at: null } } };
assert.equal(reapplyExpansions(blankReport(), edited.expansions).status, phrase.expansion);
console.log('CONFIRMED: regeneration restores the original preset after manual correction.');

assert.equal(removeExpansion(`Tender abdomen.\nExample quotation: ${phrase.expansion}`, phrase.expansion), 'Tender abdomen.\nExample quotation: ');
console.log('CONFIRMED: Undo can remove an unrelated matching quotation after the actual insertion was edited.');

const twice = applyExpansionTo(inserted, 'source-2', phrase.trigger, phrase, options('expansion-2'));
assert.equal(twice.expansions.length, 2);
assert.equal(twice.sections.status.content, `${phrase.expansion}\n${phrase.expansion}`);
const regenerated = reapplyExpansions(blankReport(), twice.expansions);
assert.equal(regenerated.status, phrase.expansion);
const firstUndo = removeExpansion(regenerated.status, phrase.expansion);
assert.equal(firstUndo, '');
assert.equal(removeExpansion(firstUndo, phrase.expansion), null);
console.log('CONFIRMED: two expansion records collapse to one paragraph; the second Undo gets stuck.');

const counts = new Map();
const consume = async (bucket, limit) => {
  const used = (counts.get(bucket) ?? 0) + 1;
  counts.set(bucket, used);
  return used <= limit ? limit - used : -1;
};
for (let i = 0; i < 5; i++) await reserveQuota(consume, 'reports', 'test-session', 'test-network');
await assert.rejects(reserveQuota(consume, 'reports', 'test-session', 'test-network'), /Лимитът за тази демо сесия/);
assert.equal(counts.get('ip:test-network:day:reports'), 6);
console.log('CONFIRMED: a session-quota rejection still increments the shared IP daily counter.');
console.log('5 evidence checks passed. These do not test live provider output, SQL or UI lifecycle.');
