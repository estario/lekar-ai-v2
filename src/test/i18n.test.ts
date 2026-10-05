import { describe, expect, it } from 'vitest';
import { detectLanguage, demoSessionsFor, localizeError, sectionLabelsByLang, ui } from '@/lib/i18n';

describe('language', () => {
  it('defaults from the primary browser language', () => {
    expect(detectLanguage({ languages: ['bg-BG', 'en'] })).toBe('bg');
    expect(detectLanguage({ languages: ['en-US', 'bg'] })).toBe('en');
    expect(detectLanguage({ languages: [], language: 'bg' })).toBe('bg');
    expect(detectLanguage({ language: 'de-DE' })).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
  it('has matching dictionaries and English samples', () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.bg).sort());
    expect(Object.keys(sectionLabelsByLang.en)).toEqual(Object.keys(sectionLabelsByLang.bg));
    expect(demoSessionsFor('en')[0]?.segments[0]?.text).toMatch(/Good afternoon/);
    expect(ui.en.exportHeader).toBe('DEMO — fictional data, not for medical use.');
  });
  it('translates known server errors for English', () => {
    expect(localizeError('en', 'Твърде много заявки. Изчакайте минута.', 'x')).toBe('Too many requests. Wait a minute.');
    expect(localizeError('bg', 'Твърде много заявки.', 'x')).toBe('Твърде много заявки.');
  });
});

