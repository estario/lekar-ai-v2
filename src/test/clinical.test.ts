import { describe, expect, it } from 'vitest';
import { demoSessions, emptySections, maskIdentifier, sectionLabels } from '@/lib/clinical';

describe('clinical demo', () => {
 it('starts with synthetic draft and two reviewed report sections', () => {
  const example = demoSessions[0];
  expect(example).toBeDefined();
  if (!example) return;
  expect(example.status).toBe('draft');
  expect(Object.values(example.sections).filter(section=>section.verified_at)).toHaveLength(2);
  expect(example.patient_identifier).toBe('');
 });
 it('keeps all four compatibility report keys', () => {
  expect(Object.keys(emptySections())).toEqual(['anamneza','status','izsledvania','terapia']);
  expect(Object.keys(sectionLabels)).toHaveLength(4);
 });
 it('never invents a missing identifier', () => {
  expect(maskIdentifier('')).toBe('Не е посочено');
  expect(maskIdentifier('1234567890')).toBe('12••••••90');
 });
});

