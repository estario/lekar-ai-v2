import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { CLINICAL_OUTPUT_CAPS, CLINICAL_SONIOX_MAX_SECONDS, gatedCall, requireClinicalAccess } from './clinical-gate';
import { CLINICAL_ASSISTANT_BUDGET, CLINICAL_REPORT_BUDGET, buildTranscript, newestChronological } from './ai-input';

// Every handler: authenticated -> approved clinician/admin role (fail closed) -> ownership + complete
// input validation -> minute + daily budget -> provider. Nothing is sliced silently.
const idSchema = z.string().uuid();
async function ownSession(context:any,id:string) {
 const {data,error}=await context.supabase.from('consultations').select('id,mode,consent_at,consent_notice_version').eq('id',id).eq('clinician_id',context.userId).maybeSingle();
 if(error || !data) throw new Error('Прегледът не е достъпен.');
 return data;
}
async function loadSegments(context:any,id:string){
 const {data,error}=await context.supabase.from('transcript_segments').select('speaker,speaker_id,text,client_seq,created_at').eq('consultation_id',id).order('client_seq',{ascending:true,nullsFirst:true}).order('created_at');
 if(error) throw new Error('Разговорът не може да бъде зареден.');
 return (data||[]) as {speaker:'doctor'|'patient';speaker_id:string|null;text:string}[];
}
export const generateReport = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema}).parse(input))
 .handler(async ({data,context})=>gatedCall(context.supabase,'report',async()=>{
   await ownSession(context,data.id);
   const segments=await loadSegments(context,data.id);
   const transcript=buildTranscript(segments,CLINICAL_REPORT_BUDGET);
   const {data:profile}=await context.supabase.from('clinician_profiles').select('specialty,ai_instructions').eq('user_id',context.userId).maybeSingle();
   const {data:template}=profile?.specialty ? await context.supabase.from('specialty_templates').select('instructions').eq('specialty',profile.specialty).maybeSingle() : {data:null};
   return {transcript,profile,template};
  },async({transcript,profile,template})=>{
   const apiKey=process.env['LOVABLE_API_KEY'];
   if(!apiKey)throw new Error('Lovable AI не е настроен.');
   const {streamClinicalText}=await import('@/lib/ai/clinical.server');
   const result=streamClinicalText(apiKey,[{role:'system',content:`Структурирай само действително казаното в медицинския разговор. Не измисляй находки, диагноза, лекарства или изследвания. Неподкрепените раздели остави празни. Отговори САМО с JSON обект със string полета anamneza,status,izsledvania,terapia. Специалност: ${profile?.specialty||'непосочена'}. Шаблон: ${template?.instructions||''}. Лекарски инструкции: ${profile?.ai_instructions||''}`},{role:'user',content:transcript}],{maxOutputTokens:CLINICAL_OUTPUT_CAPS.report});
   const text=await result.text;
   if((await result.finishReason)==='length') throw new Error('Отчетът е твърде дълъг. Съкратете разговора и опитайте отново.');
   let parsed:unknown;
   try { parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')); } catch { throw new Error('Отговорът не е в очаквания формат. Опитайте отново.'); }
   const checked=z.object({anamneza:z.string(),status:z.string(),izsledvania:z.string(),terapia:z.string()}).safeParse(parsed);
   if(!checked.success) throw new Error('Получен е непълен отчет. Опитайте отново.');
   return checked.data;
  }));
export const askAssistant=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema,question:z.string().trim().min(1).max(2000)}).parse(input))
 .handler(async ({data,context})=>gatedCall(context.supabase,'assistant',async()=>{
   await ownSession(context,data.id);
   const transcript=buildTranscript(await loadSegments(context,data.id),CLINICAL_ASSISTANT_BUDGET,true);
   // Newest 30 messages, then chronological order.
   const {data:history,error}=await context.supabase.from('session_chat_messages').select('role,content').eq('consultation_id',data.id).order('created_at',{ascending:false}).limit(30);
   if(error) throw new Error('Историята не може да бъде заредена.');
   const prior=newestChronological(history as {role:string;content:string}[],30).filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role as 'user'|'assistant',content:m.content}));
   return {transcript,prior};
  },async({transcript,prior})=>{
   const apiKey=process.env['LOVABLE_API_KEY'];
   if(!apiKey)throw new Error('Lovable AI не е настроен.');
   const {streamClinicalText}=await import('@/lib/ai/clinical.server');
   const result=streamClinicalText(apiKey,[{role:'system',content:'Ти си помощник за документация на лекар. Давай кратки предложения на български само въз основа на предоставения разговор. Изрично обозначавай липсваща информация. Не поставяй самостоятелно диагнози и не предписвай терапия.'},{role:'user',content:`Разговор:\n${transcript||'(празен)'}`},...prior,{role:'user',content:data.question}],{maxOutputTokens:CLINICAL_OUTPUT_CAPS.assistant});
   const text=await result.text;
   if(!text.trim()) throw new Error('Асистентът не върна предложение.');
   return {text};
  }));
export const getSonioxKey=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema}).parse(input))
 .handler(async ({data,context})=>gatedCall(context.supabase,'recording',async()=>{
   const session=await ownSession(context,data.id);
   if(session.mode==='conversation'&&(!session.consent_at||session.consent_notice_version!=='v1.0'))throw new Error('Няма валидно записано съгласие за този разговор.');
   const secret=process.env['SONIOX_API_KEY'];
   if(!secret) throw new Error('Транскрипцията не е настроена. Можете да въведете разговора ръчно.');
   return secret;
  },async(secret)=>{
   const response=await fetch('https://api.soniox.com/v1/auth/temporary-api-key',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({usage_type:'transcribe_websocket',expires_in_seconds:60,max_session_duration_seconds:CLINICAL_SONIOX_MAX_SECONDS,single_use:true})});
   if(!response.ok) throw new Error('Не може да се стартира транскрипция. Опитайте отново.');
   const payload=await response.json() as {api_key?:string};
   if(!payload.api_key) throw new Error('Липсва временен ключ за транскрипция.');
   return {api_key:payload.api_key,maxSeconds:CLINICAL_SONIOX_MAX_SECONDS};
  }));

export const getIntegrationStatus=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireClinicalAccess(context.supabase);
 return {sonioxConfigured:Boolean(process.env['SONIOX_API_KEY']),aiConfigured:Boolean(process.env['LOVABLE_API_KEY'])};
});
