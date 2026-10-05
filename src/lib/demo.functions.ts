import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { DEMO_QUOTAS, isAllowedOrigin, reserveQuota, sha256Hex, signDemoToken, verifyDemoToken, type DemoQuotaKind } from './demo-token';

// Public demo endpoints. They never touch clinical tables; only hashed quota counters are written.
// Speech and transcript text are never logged.
const tokenSchema = z.string().min(20).max(600);
const segmentSchema = z.object({ speaker: z.enum(['doctor', 'patient']), speaker_id: z.string().max(40).nullable().optional(), text: z.string().trim().min(1).max(1500) });
const languageSchema = z.enum(['bg', 'en']).default('bg');
const langLine = (l: 'bg' | 'en') => l === 'en' ? ' Write ALL output text in English (keep the exact JSON keys if JSON is requested).' : ' Пиши целия текст на български.';
const segmentsSchema = z.array(segmentSchema).min(1).max(120);

function secret() {
  const s = process.env['LOVABLE_API_KEY'];
  if (!s) throw new Error('Демото не е настроено.');
  return s;
}
async function guard(token?: string) {
  const request = getRequest();
  if (!isAllowedOrigin(request.headers, request.url)) throw new Error('Заявката не е разрешена.');
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ipHash = (await sha256Hex(`${secret()}|ip|${ip}`)).slice(0, 32);
  const claims = token ? await verifyDemoToken(secret(), token) : null;
  return { ipHash, claims };
}
async function consume(bucket: string, limit: number, windowSeconds: number) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('demo_consume', { _bucket: bucket, _limit: limit, _window_seconds: windowSeconds });
  if (error) throw new Error('Лимитът не може да бъде проверен. Опитайте по-късно.');
  return data as number;
}
const quota = (kind: DemoQuotaKind, sid: string, ipHash: string) => reserveQuota(consume, kind, sid, ipHash);
const transcriptOf = (segments: z.infer<typeof segmentsSchema>, max: number) =>
  segments.map(s => `${s.speaker_id ? `Говорител ${s.speaker_id}` : s.speaker === 'doctor' ? 'Лекар' : 'Пациент'}: ${s.text}`).join('\n').slice(0, max);

export const startDemo = createServerFn({ method: 'POST' }).handler(async () => {
  const { ipHash } = await guard();
  if ((await consume(`ip:${ipHash}:sessions`, 20, 86400)) < 0) throw new Error('Достигнат е дневният брой демо сесии за тази мрежа.');
  const { token, claims } = await signDemoToken(secret());
  return { token, expiresAt: claims.exp, quotas: { ...DEMO_QUOTAS } };
});

export const demoReport = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema, segments: segmentsSchema, specialty: z.string().max(120).default(''), instructions: z.string().max(600).default(''), language: languageSchema }).parse(input))
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const left = await quota('reports', claims!.sid, ipHash);
    const { streamClinicalText } = await import('@/lib/ai/clinical.server');
    const result = streamClinicalText(secret(), [
      { role: 'system', content: `ДЕМО със синтетични данни. Структурирай само действително казаното в медицинския разговор. Не измисляй находки, диагноза, лекарства или изследвания. Неподкрепените раздели остави празни. Всеки раздел до 120 думи. Отговори САМО с JSON обект със string полета anamneza,status,izsledvania,terapia. Специалност: ${data.specialty || 'непосочена'}. Лекарски инструкции: ${data.instructions}${langLine(data.language)}` },
      { role: 'user', content: transcriptOf(data.segments, 12000) },
    ], { maxOutputTokens: 3000 });
    const text = await result.text;
    if ((await result.finishReason) === 'length') throw new Error('Отчетът е твърде дълъг за демото. Съкратете разговора и опитайте отново.');
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Отговорът не е в очаквания формат. Опитайте отново.'); }
    const checked = z.object({ anamneza: z.string(), status: z.string(), izsledvania: z.string(), terapia: z.string() }).safeParse(parsed);
    if (!checked.success) throw new Error('Получен е непълен отчет. Опитайте отново.');
    return { report: checked.data, remaining: left };
  });

export const demoAssistant = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({
    token: tokenSchema, segments: z.array(segmentSchema).max(120), question: z.string().trim().min(1).max(1000), language: languageSchema,
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(3000) })).max(10),
  }).parse(input))
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const left = await quota('assistant', claims!.sid, ipHash);
    const { streamClinicalText } = await import('@/lib/ai/clinical.server');
    const result = streamClinicalText(secret(), [
      { role: 'system', content: `ДЕМО със синтетични данни. Ти си помощник за документация на лекар. Давай кратки предложения ${data.language === 'en' ? 'на английски' : 'на български'} (до 150 думи) само въз основа на предоставения разговор. Изрично обозначавай липсваща информация. Не поставяй самостоятелно диагнози и не предписвай терапия.` + langLine(data.language) },
      { role: 'user', content: `Разговор:\n${data.segments.length ? transcriptOf(data.segments, 8000) : '(празен)'}` },
      ...data.history, { role: 'user', content: data.question },
    ], { maxOutputTokens: 2000 });
    const text = await result.text;
    if (!text.trim()) throw new Error('Асистентът не върна предложение.');
    return { text, remaining: left };
  });

export const demoSonioxKey = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const key = process.env['SONIOX_API_KEY'];
    if (!key) throw new Error('Транскрипцията не е настроена. Въведете разговора ръчно.');
    const left = await quota('recordings', claims!.sid, ipHash);
    const response = await fetch('https://api.soniox.com/v1/auth/temporary-api-key', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ usage_type: 'transcribe_websocket', expires_in_seconds: 60, max_session_duration_seconds: 300, single_use: true }) });
    if (!response.ok) throw new Error('Не може да се стартира транскрипция. Опитайте отново.');
    const payload = await response.json() as { api_key?: string };
    if (!payload.api_key) throw new Error('Липсва временен ключ за транскрипция.');
    return { api_key: payload.api_key, remaining: left, maxSeconds: 300 };
  });

