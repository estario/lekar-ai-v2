import { demoSessions, emptySections, type SectionKey, type Session } from './clinical';

export type Language = 'bg' | 'en';
export const LANG_STORAGE_KEY = 'lekar-demo-lang';

/** First-visit default: primary browser language starting with "bg" → Bulgarian, everything else → English. */
export function detectLanguage(nav: { languages?: readonly string[]; language?: string } | undefined): Language {
  const primary = (nav?.languages?.[0] || nav?.language || '').toLowerCase();
  return primary.startsWith('bg') ? 'bg' : 'en';
}
export const isLanguage = (v: unknown): v is Language => v === 'bg' || v === 'en';

export const sectionLabelsByLang: Record<Language, Record<SectionKey, string>> = {
  bg: { anamneza: 'Анамнеза', status: 'Статус', izsledvania: 'Изследвания', terapia: 'Терапия' },
  en: { anamneza: 'History', status: 'Examination', izsledvania: 'Investigations', terapia: 'Plan & therapy' },
};

const bg = {
  sessions: 'Прегледи', settings: 'Настройки', admin: 'Админ панел', new: 'Нов преглед', conversation: 'Разговор', assistant: 'Асистент', all: 'Всички', drafts: 'Чернови', today: 'Днес', yesterday: 'Вчера', older: 'По-рано', search: 'Име или ЕГН', searchDemo: 'Име', logout: 'Изход',
  langLabel: 'Език', langSwitch: 'Смени език', loading: 'Зареждане…', noSessions: 'Няма прегледи.', noName: 'Без име', min: 'мин', draft: 'Чернова', doctor: 'Лекар', noSpecialty: 'Специалност не е посочена',
  endDemo: 'Край на демото', endDemoConfirm: 'Да се изтрие ли всичко от тази демо сесия?', openMenu: 'Отвори менюто', closeMenu: 'Затвори менюто', closeMsg: 'Затвори съобщението',
  landingTitle: 'Lekar AI — Демо', landingSub: 'Запишете измислен разговор, получете структуриран отчет и го проверете.',
  landingWarning: 'Само за демонстрация. Използвайте измислени данни. Не въвеждайте данни за реални пациенти. Не е предназначено за медицинска практика.',
  landing1: '· Без профил и парола. Работните данни не се запазват в приложението и се изчистват при презареждане или изход.',
  landing2: '· Докато ползвате демото, гласът Ви се изпраща за разпознаване на Soniox (САЩ), а текстът на разговора — на AI модел чрез Lovable AI. Тези външни доставчици обработват данните по свои правила; не твърдим, че те не ги съхраняват.',
  landing3: '· Ограничения за една демо сесия: 3 записа до 5 минути, 5 отчета, 10 въпроса към асистента.',
  ackAria: 'Потвърждение за демо', ack: 'Разбирам, че ще използвам само измислени данни и че гласът и текстът се обработват от Soniox (САЩ) и AI модел.',
  starting: 'Стартиране…', enter: 'Влез в демото', loginLink: 'Вход за регистрирани лекари', demoStartFail: 'Демото не може да стартира.',
  banner: (r: number, p: number, a: number) => `ДЕМО · Само измислени данни · Нищо не се запазва — изтрива се при презареждане или изход · Остават: ${r} записа, ${p} отчета, ${a} въпроса`,
  back: 'Прегледи', newSub: 'Създайте нова клинична бележка', patientName: 'Име на пациент', optional: '(по избор)', fakeName: 'Измислено име', enterName: 'Въведете име',
  mode: 'Режим на прегледа', modeConv: 'Разговор с пациент', modeDict: 'Диктовка', scenarioTitle: 'Измислен сценарий',
  scenarioText: 'Потвърждавам, че разговорът е измислен сценарий и всички участници в записа знаят, че гласът им се записва и обработва от Soniox (САЩ) и AI модел за демонстрация.',
  dictNote: 'Режимът е само за диктовка от лекаря. Не записвайте пациент без съгласие.', create: 'Създай преглед', needConsent: 'За разговор с пациент е необходимо изрично съгласие.',
  created: 'Прегледът е създаден. Можете да добавите текст ръчно или да стартирате запис.', createFail: 'Прегледът не е създаден.',
  noneSelected: 'Няма избран преглед', createFirst: 'Създайте първия си преглед.', unnamedPatient: 'Пациент без име', ageSexMissing: 'Възраст и пол: не са посочени', years: 'г.',
  visit: 'Преглед', consentLabel: 'Съгласие за запис', scenarioLabel: 'Сценарий', consentGiven: (t: string) => `✓ Дадено, ${t}`, scenarioGiven: (t: string) => `✓ Потвърден, ${t}`, missing: 'Липсва', dictByDoctor: 'Диктовка от лекар',
  dictateMore: '+ Диктувай допълнение', swapTitle: 'Размени ролите за следващата реплика', swap: 'Размени ролите', noText: 'Все още няма записан текст.', speakerN: (id: string) => `Говорител ${id}`, unknownSpeaker: 'Неуточнен говорител', patient: 'Пациент', live: 'На живо:',
  demoRecNote: (n: number) => `Демо запис до 5 минути · гласът се обработва от Soniox (САЩ) · остават ${n} записа. Може и ръчно.`,
  manualEntry: 'Ръчно въвеждане', waitingFinal: 'Изчакване на окончателния текст…', paused: 'Пауза', recordingL: 'Запис', startRec: 'Започни запис', recLimitOut: 'Лимитът за записи е изчерпан', resume: 'Продължи', pause: 'Пауза', finish: 'Завърши',
  speakerAria: 'Говорител', segAria: 'Текст на реплика', segPh: 'Добавете реплика…', addSeg: 'Добави реплика',
  verified: (n: number) => `Проверени ${n} от 4`, demoOnly: 'Само в демо сесията', savingL: 'Запазва се…', saveErr: 'Грешка при запазване', savedL: 'Запазено',
  generating: 'Генериране…', generate: 'Генерирай от разговор', copyAll: 'Копирай всичко за МИС', copyX: (s: string) => `Копирай ${s}`, verifiedBtn: 'Проверено', verifyBtn: 'Провери', sectionPh: 'Няма данни от разговора. Добавете информация след преглед.',
  instructionsTitle: 'Указания към пациента', print: 'Печат', instructionsPh: 'Добавете ясни указания за пациента…', notConfigured: 'Не е настроено', emailNC: 'Имейл · Не е настроено', smsNC: 'SMS · Не е настроено', medDoc: 'Медицински документ',
  settingsSub: 'Личен профил и предпочитания за документацията', profile: 'Профил', name: 'Име', specialty: 'Специалност', aiInstr: 'Инструкции за AI', aiInstrSub: 'Указания за стила на медицинския документ.', aiInstrPh: 'Например: използвай кратки изречения…',
  phrases: 'Замени на фрази', phraseOrig: 'Оригинална фраза', phraseRepl: 'Замяна', phraseDel: 'Изтрий фраза', phraseNew: 'Нова фраза', phraseNewRepl: 'Нова замяна', phraseHeard: 'Чута фраза', phraseCorrect: 'Правилна форма', add: 'Добави',
  vpTitle: 'Гласови фрази', vpSub: 'Кратка изговорена фраза на лекаря вмъква предварително зададен текст в избран раздел. Само за тази демо сесия в браузъра.', vpPreset: 'Предварително зададен демо текст — редактируем, изисква преглед от лекар; не е извлечен от AI и не е казан от пациента.', vpTrigger: 'Фраза за задействане', vpExpansion: 'Текст за вмъкване', vpSection: 'Раздел', vpLang: 'Език', vpEnabled: 'Активна', vpDelete: 'Изтрий гласова фраза', vpAdd: 'Добави гласова фраза', vpEmpty: 'Въведете фраза за задействане.', vpEmptyText: 'Въведете текст за вмъкване.', vpDuplicate: 'Вече има такава фраза на този език.', vpNone: 'Няма активни гласови фрази за избрания език.', vpInsert: 'Вмъкни', vpTry: 'Пробвай фраза', vpTryPh: 'напр. корем нормален', vpTryHint: 'Добавя се като реплика на лекаря и минава през същата проверка като окончателния текст от записа. Без микрофон, лимит или AI.', vpNoMatch: 'Няма точно съвпадение — добавено само като реплика.', vpUndo: 'Отмени последното вмъкване', vpUndoMissing: 'Вмъкнатият текст е редактиран и не може да бъде отменен автоматично.', vpUndone: 'Последното вмъкване е отменено.', vpInserted: (s: string) => `Шаблонен текст е вмъкнат в „${s}“ — изисква преглед.`, vpFrom: (cue: string, manual: boolean) => manual ? `Шаблон „${cue}“ (ръчно)` : `Шаблон от фраза „${cue}“`, vpReview: 'изисква преглед', vpOpen: 'Гласови фрази', vpPatientNote: 'Разширяват се само реплики на лекаря (диктовка или ръчно въведени). Реплики на пациента и междинен текст никога.',
  recSection: 'Запис', speakerLabels: 'Показвай етикети на говорителите', demoMicNote: 'Демо: записът използва Soniox (САЩ) с временен ключ.', noAudio: 'Звуковите файлове не се съхраняват автоматично.', saveSettings: 'Запази настройките', demoSettingsSaved: 'Промените са само за тази демо сесия.',
  assistantNote: 'Предложения за преглед от лекар. Информацията не се вмъква автоматично в документа.', closeAssistant: 'Затвори асистента', you: 'Вие', insertInto: 'Вмъкни предложение в', addForReview: 'Добави за преглед', addedDraft: 'Предложението е добавено като непроверена чернова.',
  quick: ['Какво липсва в анамнезата?', 'Обобщи разговора'], askAria: 'Въпрос към асистента', askPh: 'Попитайте за документацията…', send: 'Изпрати', noAnswer: 'Асистентът не отговори.',
  copied: 'Копирано в клипборда.', copiedUnverified: 'Копирано. Внимание: документът съдържа непроверени раздели.', copyDenied: 'Копирането не беше позволено от браузъра.',
  needText: 'Добавете текст към разговора преди генериране.', draftReady: 'Черновата е готова. Проверете всеки раздел.', genFail: 'Неуспешно генериране.',
  finishFirst: 'Завършете записа и изчакайте запазването на всички реплики.', unsaved: 'Има незапазени реплики. Проверете разговора преди генериране.',
    partialSave: (list: string) => `Чернова е генерирана, но не се запазиха в облака: ${list}. Редактирайте или опитайте отново.`, navBlocked: 'Завършете записа, преди да смените екрана или прегледа.',
  noConsentRec: 'Няма записано съгласие за този разговор. Записът не може да започне.', recInterrupted: 'Записът беше прекъснат.', recCheck: ' Завършете записа и проверете текста преди генериране.', micUnavailable: 'Микрофонът не е достъпен. Ръчният текст остава наличен.',
  recLimitHit: 'Достигнат е лимитът от 5 минути за демо запис. Записът се завършва.', recDone: 'Записът е завършен. Прегледайте текста преди генериране.', recFail: 'Записът не завърши успешно.', segsLost: 'Част от репликите не бяха запазени. Проверете разговора и ги въведете отново преди генериране.',
  tooLong: (p: 'empty' | 'count' | 'segment' | 'total'): string => p === 'empty' ? 'Добавете текст към разговора преди генериране.' : p === 'count' ? 'Разговорът има твърде много реплики за една заявка. Нищо не е изпратено.' : p === 'segment' ? 'Има реплика, която е твърде дълга. Разделете я. Нищо не е изпратено.' : 'Разговорът е твърде дълъг за една заявка. Нищо не е изпратено и лимитът не е използван.',
  overwriteAsk: (list: string) => `Разделите „${list}“ са проверени или ръчно редактирани. Да бъдат ли заменени с нова чернова? (Отказ = запазват се непроменени.)`,
  nothingReplaced: 'Всички раздели са запазени. Нищо не е генерирано.',
  keptSections: (list: string) => `Запазени без промяна: ${list}.`,
  needEvidence: 'Няма реплики за обработка. Добавете разговор или гласова фраза.',
  recWallLimit: 'Достигнат е лимитът на записа (включително паузите). Записът се завършва автоматично.',
  recProviderEnded: 'Връзката с транскрипцията прекъсна. Получените реплики са запазени; можете да започнете нов запис.',
  vpCommand: 'гласова команда (не се изпраща към AI)',
  vpOrphaned: 'редактирано ръчно — не може да се отмени',
  notApprovedTitle: 'Профилът очаква одобрение',
  notApprovedText: 'Влезли сте, но профилът Ви още не е одобрен за клинична работа. Дотогава можете да използвате демото с измислени данни.',
  approveClinician: 'Клиничен достъп',
  exportHeader: 'ДЕМО — измислени данни, не за медицинска употреба.', demoDoctor: 'Демо лекар', demoSpecialty: 'Обща медицина',
};
type Dict = typeof bg;
const en: Dict = {
  sessions: 'Consultations', settings: 'Settings', admin: 'Admin panel', new: 'New consultation', conversation: 'Conversation', assistant: 'Assistant', all: 'All', drafts: 'Drafts', today: 'Today', yesterday: 'Yesterday', older: 'Earlier', search: 'Name or ID', searchDemo: 'Name', logout: 'Sign out',
  langLabel: 'Language', langSwitch: 'Change language', loading: 'Loading…', noSessions: 'No consultations.', noName: 'Unnamed', min: 'min', draft: 'Draft', doctor: 'Physician', noSpecialty: 'No specialty set',
  endDemo: 'End demo', endDemoConfirm: 'Delete everything from this demo session?', openMenu: 'Open menu', closeMenu: 'Close menu', closeMsg: 'Dismiss message',
  landingTitle: 'Lekar AI — Demo', landingSub: 'Record a fictional conversation, get a structured report and review it.',
  landingWarning: 'Demonstration only. Use fictional data. Do not enter data about real patients. Not intended for medical practice.',
  landing1: '· No account or password. Work data is not saved in the app and is cleared on reload or exit.',
  landing2: '· While you use the demo, your voice is sent to Soniox (USA) for speech recognition and the conversation text to an AI model via Lovable AI. These external providers process data under their own terms; we do not claim they do not store it.',
  landing3: '· Limits per demo session: 3 recordings up to 5 minutes, 5 reports, 10 assistant questions.',
  ackAria: 'Demo acknowledgment', ack: 'I understand that I will use only fictional data and that voice and text are processed by Soniox (USA) and an AI model.',
  starting: 'Starting…', enter: 'Enter the demo', loginLink: 'Sign in for registered physicians', demoStartFail: 'The demo could not start.',
  banner: (r, p, a) => `DEMO · Fictional data only · Nothing is saved — cleared on reload or exit · Remaining: ${r} recordings, ${p} reports, ${a} questions`,
  back: 'Consultations', newSub: 'Create a new clinical note', patientName: 'Patient name', optional: '(optional)', fakeName: 'Fictional name', enterName: 'Enter name',
  mode: 'Consultation mode', modeConv: 'Conversation with patient', modeDict: 'Dictation', scenarioTitle: 'Fictional scenario',
  scenarioText: 'I confirm the conversation is a fictional scenario and everyone in the recording knows their voice is recorded and processed by Soniox (USA) and an AI model for demonstration.',
  dictNote: 'This mode is for physician dictation only. Do not record a patient without consent.', create: 'Create consultation', needConsent: 'Please confirm the fictional scenario acknowledgment first.',
  created: 'Consultation created. You can add text manually or start recording.', createFail: 'The consultation was not created.',
  noneSelected: 'No consultation selected', createFirst: 'Create your first consultation.', unnamedPatient: 'Unnamed patient', ageSexMissing: 'Age and sex: not provided', years: 'y',
  visit: 'Consultation', consentLabel: 'Recording consent', scenarioLabel: 'Scenario', consentGiven: (t) => `✓ Given, ${t}`, scenarioGiven: (t) => `✓ Confirmed, ${t}`, missing: 'Missing', dictByDoctor: 'Physician dictation',
  dictateMore: '+ Dictate addition', swapTitle: 'Swap roles for the next line', swap: 'Swap roles', noText: 'No text recorded yet.', speakerN: (id) => `Speaker ${id}`, unknownSpeaker: 'Unidentified speaker', patient: 'Patient', live: 'Live:',
  demoRecNote: (n) => `Demo recording up to 5 minutes · voice processed by Soniox (USA) · ${n} recordings left. Manual entry also works.`,
  manualEntry: 'Manual entry', waitingFinal: 'Waiting for final text…', paused: 'Paused', recordingL: 'Recording', startRec: 'Start recording', recLimitOut: 'Recording limit reached', resume: 'Resume', pause: 'Pause', finish: 'Finish',
  speakerAria: 'Speaker', segAria: 'Line text', segPh: 'Add a line…', addSeg: 'Add line',
  verified: (n) => `Verified ${n} of 4`, demoOnly: 'Demo session only', savingL: 'Saving…', saveErr: 'Save error', savedL: 'Saved',
  generating: 'Generating…', generate: 'Generate from conversation', copyAll: 'Copy all for EHR', copyX: (s) => `Copy ${s}`, verifiedBtn: 'Verified', verifyBtn: 'Verify', sectionPh: 'No data from the conversation. Add information after review.',
  instructionsTitle: 'Patient instructions', print: 'Print', instructionsPh: 'Add clear instructions for the patient…', notConfigured: 'Not configured', emailNC: 'Email · Not configured', smsNC: 'SMS · Not configured', medDoc: 'Medical document',
  settingsSub: 'Personal profile and documentation preferences', profile: 'Profile', name: 'Name', specialty: 'Specialty', aiInstr: 'AI instructions', aiInstrSub: 'Guidance on the style of the medical document.', aiInstrPh: 'For example: use short sentences…',
  phrases: 'Phrase replacements', phraseOrig: 'Original phrase', phraseRepl: 'Replacement', phraseDel: 'Delete phrase', phraseNew: 'New phrase', phraseNewRepl: 'New replacement', phraseHeard: 'Heard phrase', phraseCorrect: 'Correct form', add: 'Add',
  vpTitle: 'Voice phrases', vpSub: 'A short spoken cue from the physician inserts a predefined paragraph into a chosen section. This demo browser tab only.', vpPreset: 'Preconfigured demo text — editable, requires physician review; not AI-derived and not spoken by the patient.', vpTrigger: 'Trigger phrase', vpExpansion: 'Text to insert', vpSection: 'Section', vpLang: 'Language', vpEnabled: 'Enabled', vpDelete: 'Delete voice phrase', vpAdd: 'Add voice phrase', vpEmpty: 'Enter a trigger phrase.', vpEmptyText: 'Enter text to insert.', vpDuplicate: 'This trigger already exists for this language.', vpNone: 'No enabled voice phrases for the selected language.', vpInsert: 'Insert', vpTry: 'Try phrase', vpTryPh: 'e.g. abdomen normal', vpTryHint: 'Added as a physician line and checked exactly like finalized recording text. No microphone, quota or AI.', vpNoMatch: 'No exact match — added as a line only.', vpUndo: 'Undo latest insertion', vpUndoMissing: 'The inserted text was edited and cannot be undone automatically.', vpUndone: 'Latest insertion undone.', vpInserted: (s: string) => `Template text inserted into "${s}" — needs review.`, vpFrom: (cue: string, manual: boolean) => manual ? `Template "${cue}" (manual)` : `Template from cue "${cue}"`, vpReview: 'needs review', vpOpen: 'Voice phrases', vpPatientNote: 'Only physician lines expand (dictation or typed). Patient lines and interim text never do.',
  recSection: 'Recording', speakerLabels: 'Show speaker labels', demoMicNote: 'Demo: recording uses Soniox (USA) with a temporary key.', noAudio: 'Audio files are not stored automatically.', saveSettings: 'Save settings', demoSettingsSaved: 'Changes apply to this demo session only.',
  assistantNote: 'Suggestions for physician review. Nothing is inserted into the document automatically.', closeAssistant: 'Close assistant', you: 'You', insertInto: 'Insert suggestion into', addForReview: 'Add for review', addedDraft: 'Suggestion added as an unverified draft.',
  quick: ['What is missing from the history?', 'Summarize the conversation'], askAria: 'Question for the assistant', askPh: 'Ask about the documentation…', send: 'Send', noAnswer: 'The assistant did not respond.',
  copied: 'Copied to clipboard.', copiedUnverified: 'Copied. Note: the document contains unverified sections.', copyDenied: 'The browser did not allow copying.',
  needText: 'Add conversation text before generating.', draftReady: 'The draft is ready. Review each section.', genFail: 'Generation failed.',
  finishFirst: 'Finish recording and wait for all lines to be saved.', unsaved: 'Some lines were not saved. Check the conversation before generating.',
    partialSave: (list: string) => `Draft generated, but these sections were not saved to the cloud: ${list}. Edit or retry.`, navBlocked: 'Finish recording before changing screen or consultation.',
  noConsentRec: 'No acknowledgment recorded for this conversation. Recording cannot start.', recInterrupted: 'Recording was interrupted.', recCheck: ' Finish recording and check the text before generating.', micUnavailable: 'Microphone unavailable. Manual entry remains available.',
  recLimitHit: 'The 5-minute demo recording limit was reached. Finishing the recording.', recDone: 'Recording finished. Review the text before generating.', recFail: 'Recording did not finish successfully.', segsLost: 'Some lines were not saved. Check the conversation and re-enter them before generating.',
  tooLong: (p: 'empty' | 'count' | 'segment' | 'total') => p === 'empty' ? 'Add conversation text before generating.' : p === 'count' ? 'The conversation has too many lines for one request. Nothing was sent.' : p === 'segment' ? 'One line is too long. Split it. Nothing was sent.' : 'The conversation is too long for one request. Nothing was sent and no quota was used.',
  overwriteAsk: (list: string) => `The sections “${list}” are verified or manually edited. Replace them with a new draft? (Cancel = keep them unchanged.)`,
  nothingReplaced: 'All sections were kept. Nothing was generated.',
  keptSections: (list: string) => `Kept unchanged: ${list}.`,
  needEvidence: 'There are no lines to process. Add conversation or a voice phrase.',
  recWallLimit: 'The recording limit (pauses included) was reached. Finishing the recording automatically.',
  recProviderEnded: 'The transcription connection ended. Received lines are saved; you can start a new recording.',
  vpCommand: 'voice command (not sent to AI)',
  vpOrphaned: 'edited manually — cannot be undone',
  notApprovedTitle: 'Account awaiting approval',
  notApprovedText: 'You are signed in, but your account is not yet approved for clinical work. Meanwhile you can use the demo with fictional data.',
  approveClinician: 'Clinical access',
  exportHeader: 'DEMO — fictional data, not for medical use.', demoDoctor: 'Demo physician', demoSpecialty: 'General practice',
};
export const ui: Record<Language, Dict> = { bg, en };

/** Known Bulgarian server messages → English, so English visitors never see untranslated errors. */
const serverErrorsEn: [string, string][] = [
  ['Входът е твърде дълъг', 'The input is too long for one request. Nothing was sent.'],
  ['Дневният общ лимит', 'The overall daily demo limit has been reached. Try tomorrow.'],
  ['Профилът не е одобрен', 'This account is not approved for clinical work. Use the demo.'],
  ['Дневният клиничен лимит', 'The daily clinical limit for this service has been reached.'],
  ['Невалидна демо сесия', 'Invalid demo session. Start again.'],
  ['Демо сесията изтече', 'The demo session expired. Start again.'],
  ['Твърде много заявки', 'Too many requests. Wait a minute.'],
  ['Дневният лимит', 'The daily demo limit for this network has been reached.'],
  ['Достигнат е дневният брой', 'The daily number of demo sessions for this network has been reached.'],
  ['Лимитът за тази демо сесия', 'The limit for this demo session is used up. Start a new demo session.'],
  ['Лимитът не може да бъде проверен', 'The limit could not be checked. Try again later.'],
  ['Заявката не е разрешена', 'The request is not allowed.'],
  ['Демото не е настроено', 'The demo is not configured.'],
  ['Отчетът е твърде дълъг', 'The report is too long for the demo. Shorten the conversation and try again.'],
  ['Отговорът не е в очаквания формат', 'The response was not in the expected format. Try again.'],
  ['Получен е непълен отчет', 'An incomplete report was received. Try again.'],
  ['Асистентът не върна', 'The assistant returned no suggestion.'],
  ['Транскрипцията не е настроена', 'Transcription is not configured. Enter the conversation manually.'],
  ['Не може да се стартира транскрипция', 'Transcription could not start. Try again.'],
  ['Липсва временен ключ', 'Missing temporary transcription key.'],
];
export function localizeError(lang: Language, message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (lang === 'bg' || !/[\u0400-\u04FF]/.test(message)) return message;
  return serverErrorsEn.find(([bgPart]) => message.includes(bgPart))?.[1] ?? fallback;
}

const today = () => new Date();
export function demoSessionsFor(lang: Language): Session[] {
  const now = today();
  if (lang === 'bg') return structuredClone(demoSessions);
  return [
    { id: 'demo-1', patient_name: 'Emily Carter', patient_identifier: '', patient_age: 42, patient_sex: 'female', mode: 'conversation', status: 'draft', consent_at: now.toISOString(), duration_seconds: 742, patient_instructions: 'Drink plenty of fluids. Seek medical attention if symptoms get worse.', created_at: now.toISOString(), segments: [
      { id: 'a', speaker: 'doctor', text: 'Good afternoon. What brings you in today?', seconds: 0 },
      { id: 'b', speaker: 'patient', text: 'I have had a dry cough and a slight fever for three days. I feel more tired in the evenings.', seconds: 8 },
      { id: 'c', speaker: 'doctor', text: 'Any shortness of breath or chest pain? Are you taking any medication?', seconds: 29 },
      { id: 'd', speaker: 'patient', text: 'No shortness of breath. I took paracetamol last night.', seconds: 42 },
      { id: 'e', speaker: 'doctor', text: 'We will examine you and monitor how you are doing.', seconds: 56 },
    ], sections: {
      anamneza: { content: 'Patient reports a dry cough for three days, low-grade fever and evening fatigue. Denies shortness of breath and chest pain. Took paracetamol once.', verified_at: now.toISOString() },
      status: { content: 'General condition to be assessed at physical examination.', verified_at: null },
      izsledvania: { content: 'No investigations reported so far.', verified_at: now.toISOString() },
      terapia: { content: 'Monitoring discussed. Treatment plan to be determined after examination.', verified_at: null },
    } },
    { id: 'demo-2', patient_name: 'James Miller', patient_identifier: '', patient_age: null, patient_sex: null, mode: 'dictation', status: 'draft', consent_at: null, duration_seconds: 312, patient_instructions: '', created_at: new Date(now.getTime() - 86400000).toISOString(), segments: [{ id: 'f', speaker: 'doctor', text: 'Follow-up visit. The patient reports improvement.', seconds: 0 }], sections: emptySections() },
  ];
}

export const dateFor = (lang: Language, date: string) => new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
