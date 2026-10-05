export type SectionKey = 'anamneza' | 'status' | 'izsledvania' | 'terapia';
export const sectionLabels: Record<SectionKey,string> = { anamneza:'Анамнеза', status:'Статус', izsledvania:'Изследвания', terapia:'Терапия' };
export const keys = Object.keys(sectionLabels) as SectionKey[];
export type Segment = { id:string; speaker:'doctor'|'patient'; speaker_id?:string|null; text:string; seconds:number; seq?:number|null; command?:{ phraseId:string; cue:string }|null };
export type SectionExpansion = { id:string; sourceKey:string; phraseId:string; cue:string; text:string; section:SectionKey; at:string; manual:boolean; segmentId?:string|null; start?:number; sep?:number; status?:'active'|'orphaned' };
export type Section = { content:string; verified_at:string|null };
export type Session = { id:string; patient_name:string; patient_identifier:string; patient_age:number|null; patient_sex:string|null; mode:'conversation'|'dictation'; status:string; consent_at:string|null; duration_seconds:number; patient_instructions:string; created_at:string; segments:Segment[]; sections:Record<SectionKey,Section>; expansions?:SectionExpansion[]; revisions?:Partial<Record<SectionKey,number>>; edited?:Partial<Record<SectionKey,boolean>>; prior_context?:string; report_preset?:{template:string;style:string} };
export const emptySections = ():Record<SectionKey,Section> => ({ anamneza:{content:'',verified_at:null}, status:{content:'',verified_at:null}, izsledvania:{content:'',verified_at:null}, terapia:{content:'',verified_at:null} });
const today = new Date();
export const demoSessions:Session[] = [
 { id:'demo-1', patient_name:'Мария Петрова', patient_identifier:'', patient_age:42, patient_sex:'жена', mode:'conversation', status:'draft', consent_at:today.toISOString(), duration_seconds:742, patient_instructions:'Приемайте достатъчно течности. При влошаване на симптомите потърсете лекар.', created_at:today.toISOString(), segments:[
  {id:'a',speaker:'doctor',text:'Добър ден. Какво Ви води днес при мен?',seconds:0},
  {id:'b',speaker:'patient',text:'От три дни имам суха кашлица и леко повишена температура. Вечер се чувствам по-отпаднала.',seconds:8},
  {id:'c',speaker:'doctor',text:'Имате ли задух или болка в гърдите? Приемате ли лекарства?',seconds:29},
  {id:'d',speaker:'patient',text:'Не, нямам задух. Взех парацетамол вчера вечерта.',seconds:42},
  {id:'e',speaker:'doctor',text:'Ще направим преглед и ще проследим състоянието Ви.',seconds:56}
 ], sections:{anamneza:{content:'Пациентката съобщава за суха кашлица от три дни, субфебрилитет и отпадналост вечер. Отрича задух и гръдна болка. Приела парацетамол еднократно.',verified_at:today.toISOString()},status:{content:'Общото състояние подлежи на оценка при физикалния преглед.',verified_at:null},izsledvania:{content:'Към момента не са посочени проведени изследвания.',verified_at:today.toISOString()},terapia:{content:'Обсъдено е проследяване на състоянието. Терапевтичният план подлежи на уточняване след преглед.',verified_at:null}} },
 { id:'demo-2', patient_name:'Иван Георгиев',patient_identifier:'',patient_age:null,patient_sex:null,mode:'dictation',status:'draft',consent_at:null,duration_seconds:312,patient_instructions:'',created_at:new Date(today.getTime()-86400000).toISOString(),segments:[{id:'f',speaker:'doctor',text:'Контролен преглед. Пациентът съобщава за подобрение.',seconds:0}],sections:emptySections() }
];
export const maskIdentifier = (value:string) => value ? `${value.slice(0,2)}••••••${value.slice(-2)}` : 'Не е посочено';
export const timeBg = (date:string) => new Intl.DateTimeFormat('bg-BG',{timeZone:'Europe/Sofia',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
export const dateBg = (date:string) => new Intl.DateTimeFormat('bg-BG',{timeZone:'Europe/Sofia',day:'numeric',month:'long',year:'numeric'}).format(new Date(date));
