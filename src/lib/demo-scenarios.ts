// Three clearly fictional guided demo cases (BG/EN). No identifiers; loaded only into new in-memory sessions.
import { emptySections, type Segment, type Session } from './clinical';
import type { Language } from './i18n';

export const SCENARIO_IDS = ['cough', 'knee', 'chronic'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
type Line = [Segment['speaker'], string];
type Scenario = { title: string; summary: string; context: string; lines: Line[] };

const D = 'doctor' as const, P = 'patient' as const;
export const SCENARIOS: Record<Language, Record<ScenarioId, Scenario>> = {
  bg: {
    cough: { title: 'Измислен случай: кашлица, контролен преглед', summary: 'Обща практика · проследяване на кашлица', context: 'преди 7 дни — суха кашлица и субфебрилитет; препоръчани течности и парацетамол при нужда. Без известни алергии.', lines: [
      [D, 'Здравейте отново. Как е кашлицата от миналата седмица?'],
      [P, 'По-добре е. Температурата спадна още на третия ден, сега кашлям главно сутрин.'],
      [D, 'Имате ли задух, болка в гърдите или храчки с кръв?'],
      [P, 'Не, нямам задух, нито болка. Храчките са бели, малко.'],
      [D, 'Колко парацетамол взимахте?'],
      [P, 'Само два пъти през първите дни, после не ми трябваше.'],
      [D, 'Преслушах белите дробове — везикуларно дишане, без хрипове. Гърлото е леко зачервено. Температура 36,7.'],
      [D, 'Не назначавам изследвания днес. Продължете с течностите; ако кашлицата продължи над още две седмици или се появи температура, елате на контрол.'],
    ] },
    knee: { title: 'Измислен случай: болка в коляното', summary: 'Опорно-двигателен · дясно коляно', context: 'активен любител бегач, без предишни травми на коляното. Без хронични заболявания.', lines: [
      [D, 'Какво Ви води днес?'],
      [P, 'Боли ме дясното коляно от около десет дни, след като увеличих бягането.'],
      [D, 'Имаше ли удар, падане или усещане за изщракване?'],
      [P, 'Не, нямаше травма и нищо не е щракало. Не се е подувало и не блокира.'],
      [D, 'Къде точно е болката и кога се усилва?'],
      [P, 'Отпред, около капачката. По-силна е при слизане по стълби.'],
      [D, 'При огледа няма оток и зачервяване. Палпаторна болезненост по долния ръб на пателата. Пълен обем на движение, ставата е стабилна.'],
      [D, 'Засега без образни изследвания. Намалете бягането за две седмици и ще направим контрол след това.'],
    ] },
    chronic: { title: 'Измислен случай: контрол на артериално налягане', summary: 'Хронично заболяване · рутинен контрол', context: 'хипертония от 4 години, приема амлодипин 5 mg сутрин. Последен контрол преди 3 месеца.', lines: [
      [D, 'Как сте с налягането последните месеци?'],
      [P, 'Добре. Меря го вкъщи, обикновено е около 130 на 80.'],
      [D, 'Пропускате ли от лекарството? Имате ли главоболие, отоци или сърцебиене?'],
      [P, 'Пия го редовно. Нямам главоболие, нито отоци.'],
      [D, 'Измерих Ви 132 на 82, пулс 72 ритмичен.'],
      [D, 'Резултатите от кръвните изследвания от миналия месец са с нормален креатинин и калий.'],
      [D, 'Продължаваме същата доза амлодипин. Следващ контрол след три месеца.'],
    ] },
  },
  en: {
    cough: { title: 'Fictional case: cough follow-up', summary: 'General practice · cough follow-up', context: '7 days ago — dry cough and low-grade fever; advised fluids and paracetamol as needed. No known allergies.', lines: [
      [D, 'Hello again. How is the cough since last week?'],
      [P, 'Better. The fever went away on the third day, now I mostly cough in the mornings.'],
      [D, 'Any shortness of breath, chest pain or blood in the sputum?'],
      [P, 'No shortness of breath and no pain. A little white sputum.'],
      [D, 'How much paracetamol did you take?'],
      [P, 'Only twice in the first days, then I did not need it.'],
      [D, 'I listened to your lungs — vesicular breathing, no crackles or wheeze. Throat mildly red. Temperature 36.7.'],
      [D, 'No tests today. Keep up the fluids; if the cough lasts more than two more weeks or the fever returns, come back for review.'],
    ] },
    knee: { title: 'Fictional case: knee pain', summary: 'Musculoskeletal · right knee', context: 'recreational runner, no previous knee injuries. No chronic conditions.', lines: [
      [D, 'What brings you in today?'],
      [P, 'My right knee has hurt for about ten days, since I increased my running.'],
      [D, 'Was there any blow, fall or a clicking feeling?'],
      [P, 'No injury and no clicking. It has not swollen and does not lock.'],
      [D, 'Where exactly is the pain and when is it worse?'],
      [P, 'At the front, around the kneecap. Worse going down stairs.'],
      [D, 'On inspection no swelling or redness. Tender on palpation at the lower edge of the patella. Full range of motion, joint stable.'],
      [D, 'No imaging for now. Reduce running for two weeks and we will review afterwards.'],
    ] },
    chronic: { title: 'Fictional case: blood pressure review', summary: 'Chronic condition · routine review', context: 'hypertension for 4 years, takes amlodipine 5 mg in the morning. Last review 3 months ago.', lines: [
      [D, 'How has your blood pressure been these months?'],
      [P, 'Fine. I measure it at home, usually around 130 over 80.'],
      [D, 'Do you miss doses? Any headaches, swelling or palpitations?'],
      [P, 'I take it regularly. No headaches and no swelling.'],
      [D, 'I measured 132 over 82, pulse 72 and regular.'],
      [D, 'Last month\'s blood tests showed normal creatinine and potassium.'],
      [D, 'We continue the same amlodipine dose. Next review in three months.'],
    ] },
  },
};

/** Builds a brand-new session (fresh id); never reuses or replaces an existing session. */
export function scenarioSession(lang: Language, id: ScenarioId, now = new Date()): Session {
  const sc = SCENARIOS[lang][id];
  return {
    id: crypto.randomUUID(), patient_name: sc.title, patient_identifier: '', patient_age: null, patient_sex: null,
    mode: 'conversation', status: 'draft', consent_at: now.toISOString(), duration_seconds: sc.lines.length * 12,
    patient_instructions: '', created_at: now.toISOString(),
    segments: sc.lines.map(([speaker, text], i) => ({ id: crypto.randomUUID(), speaker, text, seconds: i * 12, seq: i + 1 })),
    sections: emptySections(), prior_context: sc.context,
  };
}
