import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const idSchema = z.string().uuid();
async function limit(context:any) {
 const {data,error}=await context.supabase.rpc('reserve_clinical_request');
 if(error || !data) throw new Error('Достигнат е лимитът от заявки. Опитайте отново след минута.');
}
async function ownSession(context:any,id:string) {
 const {data,error}=await context.supabase.from('consultations').select('id,mode,consent_at,consent_notice_version').eq('id',id).eq('clinician_id',context.userId).maybeSingle();
 if(error || !data) throw new Error('Прегледът не е достъпен.');
 return data;
}
export const generateReport = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema}).parse(input))
 .handler(async ({data,context})=>{
  await ownSession(context,data.id);await limit(context);
  const {data:segments,error}=await context.supabase.from('transcript_segments').select('speaker,speaker_id,text').eq('consultation_id',data.id).order('created_at');
  if(error || !segments?.length) throw new Error('Добавете текст към разговора преди генериране.');
  const {data:profile}=await context.supabase.from('clinician_profiles').select('specialty,ai_instructions').eq('user_id',context.userId).maybeSingle();
  const {data:template}=profile?.specialty ? await context.supabase.from('specialty_templates').select('instructions').eq('specialty',profile.specialty).maybeSingle() : {data:null};
  const transcript=segments.map(s=>`${s.speaker_id?`Говорител ${s.speaker_id}`:s.speaker==='doctor'?'Лекар':'Пациент'}: ${s.text}`).join('\n').slice(0,24000);
  const {streamClinicalText}=await import('@/lib/ai/clinical.server');
  const apiKey=process.env['LOVABLE_API_KEY'];
  if(!apiKey)throw new Error('Lovable AI не е настроен.');
  const result=streamClinicalText(apiKey,[{role:'system',content:`Структурирай само действително казаното в медицинския разговор. Не измисляй находки, диагноза, лекарства или изследвания. Неподкрепените раздели остави празни. Отговори САМО с JSON обект със string полета anamneza,status,izsledvania,terapia. Специалност: ${profile?.specialty||'непосочена'}. Шаблон: ${template?.instructions||''}. Лекарски инструкции: ${profile?.ai_instructions||''}`},{role:'user',content:transcript}]);
  const text=await result.text;
  let parsed:unknown;
  try { parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')); } catch { throw new Error('Отговорът не е в очаквания формат. Опитайте отново.'); }
  const schema=z.object({anamneza:z.string(),status:z.string(),izsledvania:z.string(),terapia:z.string()});
  const checked=schema.safeParse(parsed);
  if(!checked.success) throw new Error('Получен е непълен отчет. Опитайте отново.');
  return checked.data;
 });
export const askAssistant=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema,question:z.string().trim().min(1).max(2000)}).parse(input))
 .handler(async ({data,context})=>{
  await ownSession(context,data.id);await limit(context);
  const {data:segments}=await context.supabase.from('transcript_segments').select('speaker,speaker_id,text').eq('consultation_id',data.id).order('created_at');
  const transcript=(segments||[]).map(s=>`${s.speaker_id?`Говорител ${s.speaker_id}`:s.speaker}: ${s.text}`).join('\n').slice(0,16000);
  const {data:history}=await context.supabase.from('session_chat_messages').select('role,content').eq('consultation_id',data.id).order('created_at',{ascending:true}).limit(30);
  const prior=(history||[]).filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role as 'user'|'assistant',content:m.content}));
  const {streamClinicalText}=await import('@/lib/ai/clinical.server');
  const apiKey=process.env['LOVABLE_API_KEY'];
  if(!apiKey)throw new Error('Lovable AI не е настроен.');
  const result=streamClinicalText(apiKey,[{role:'system',content:'Ти си помощник за документация на лекар. Давай кратки предложения на български само въз основа на предоставения разговор. Изрично обозначавай липсваща информация. Не поставяй самостоятелно диагнози и не предписвай терапия.'},{role:'user',content:`Разговор:\n${transcript}`},...prior,{role:'user',content:data.question}]);
  const text=await result.text;
  if(!text.trim()) throw new Error('Асистентът не върна предложение.');
  return {text};
 });
export const getSonioxKey=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({id:idSchema}).parse(input))
 .handler(async ({data,context})=>{
  const session=await ownSession(context,data.id);await limit(context);
  if(session.mode==='conversation'&&(!session.consent_at||session.consent_notice_version!=='v1.0'))throw new Error('Няма валидно записано съгласие за този разговор.');
  const secret=process.env['SONIOX_API_KEY'];
  if(!secret) throw new Error('Транскрипцията не е настроена. Можете да въведете разговора ръчно.');
  const response=await fetch('https://api.soniox.com/v1/auth/temporary-api-key',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({usage_type:'transcribe_websocket',expires_in_seconds:60,max_session_duration_seconds:3600,single_use:true})});
  if(!response.ok) throw new Error('Не може да се стартира транскрипция. Опитайте отново.');
  const payload=await response.json() as {api_key?:string};
  if(!payload.api_key) throw new Error('Липсва временен ключ за транскрипция.');
  return {api_key:payload.api_key};
 });

export const getIntegrationStatus=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async()=>({sonioxConfigured:Boolean(process.env['SONIOX_API_KEY']),aiConfigured:Boolean(process.env['LOVABLE_API_KEY'])}));

