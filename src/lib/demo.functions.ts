import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { DEMO_QUOTAS, isAllowedOrigin, normalizeClientIp, reserveQuota, sha256Hex, signDemoToken, verifyDemoToken, type DemoQuotaKind, type Reserve } from './demo-token';
import { DOC_KINDS, DOC_LANGS, DOC_OUTPUT_CAP, DOC_SECTION_MAX, REPORT_STYLES, REPORT_TEMPLATES, checkDocumentInput, documentPrompt, presetPrompt } from './demo-scribe';
import { ASSISTANT_HISTORY_CHARS, ASSISTANT_HISTORY_MESSAGES, DEMO_ASSISTANT_BUDGET, DEMO_REPORT_BUDGET, QUESTION_MAX_CHARS, buildTranscript } from './ai-input';

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
  // Trust only the ingress-set client IP (Cloudflare). Absent -> one shared fail-closed bucket; client headers like X-Forwarded-For are ignored.
  const ip = normalizeClientIp(request.headers.get('cf-connecting-ip'));
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
const reserve: Reserve = async items => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await (supabaseAdmin.rpc as any)('demo_reserve', { _buckets: items.map(i => i.bucket), _limits: items.map(i => i.limit), _windows: items.map(i => i.window) });
  if (error || !data || typeof data !== 'object') throw new Error('Лимитът не може да бъде проверен. Опитайте по-късно.');
  const r = data as { ok: boolean; failed?: number; remaining?: number[] };
  // Stale-row cleanup runs as a separate, bounded, best-effort transaction — never inside the reservation.
  if (Math.random() < 0.05) { try { await (supabaseAdmin.rpc as any)('demo_quota_cleanup'); } catch { /* best effort */ } }
  if (r.ok !== true) return { ok: false, failed: typeof r.failed === 'number' ? r.failed : 0 };
  // Fail closed on any missing/invalid remaining value.
  if (!Array.isArray(r.remaining) || r.remaining.length !== items.length || r.remaining.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Лимитът не може да бъде проверен. Опитайте по-късно.');
  return { ok: true, remaining: r.remaining };
};
const quota = (kind: DemoQuotaKind, sid: string, ipHash: string) => reserveQuota(consume, reserve, kind, sid, ipHash);

export const startDemo = createServerFn({ method: 'POST' }).handler(async () => {
  const { ipHash } = await guard();
  if ((await consume(`ip:${ipHash}:sessions`, 20, 86400)) < 0) throw new Error('Достигнат е дневният брой демо сесии за тази мрежа.');
  const { token, claims } = await signDemoToken(secret());
  return { token, expiresAt: claims.exp, quotas: { ...DEMO_QUOTAS } };
});

export const demoReport = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema, segments: segmentsSchema, specialty: z.string().max(120).default(''), instructions: z.string().max(600).default(''), language: languageSchema, template: z.enum(REPORT_TEMPLATES).default('general'), style: z.enum(REPORT_STYLES).default('concise') }).parse(input))
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const transcript = buildTranscript(data.segments, DEMO_REPORT_BUDGET); // complete input or reject before quota
    const left = await quota('reports', claims!.sid, ipHash);
    const { streamClinicalText } = await import('@/lib/ai/clinical.server');
    const result = streamClinicalText(secret(), [
      { role: 'system', content: `ДЕМО със синтетични данни. Структурирай само действително казаното в медицинския разговор. Не измисляй находки, диагноза, лекарства или изследвания. Неподкрепените раздели остави празни. Въпросът на лекаря НИКОГА не е факт. Записвай отречен симптом само ако пациентът изрично го отрича; при въпрос за няколко симптома частичният отговор отрича само изрично назованите — за неотговорен симптом не пиши „отрича“, „не съобщава“, „няма“ или друга отрицателна формулировка — или го пропусни, или напиши, че отговорът не е уточнен. В status/izsledvania/terapia записвай само това, което лекарят реално заявява като извършен преглед, резултат или план. Не извеждай възраст, пол или диагноза, ако не са изрично казани. Ако полът не е посочен, използвай неутрални формулировки (напр. „пациентът съобщава“, безлични конструкции), без род в миналите глаголи. ${presetPrompt(data.template, data.style)} Отговори САМО с JSON обект със string полета anamneza,status,izsledvania,terapia. Специалност: ${data.specialty || 'непосочена'}. Лекарски инструкции: ${data.instructions}${langLine(data.language)}` },
      { role: 'user', content: transcript },
    ], { maxOutputTokens: 3000 });
    const text = await result.text;
    if ((await result.finishReason) === 'length') throw new Error('Отчетът е твърде дълъг за демото. Съкратете разговора и опитайте отново.');
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Отговорът не е в очаквания формат. Опитайте отново.'); }
    const checked = z.object({ anamneza: z.string(), status: z.string(), izsledvania: z.string(), terapia: z.string() }).safeParse(parsed);
    if (!checked.success) throw new Error('Получен е непълен отчет. Опитайте отново.');
    return { report: checked.data, remaining: left, preset: { template: data.template, style: data.style } };
  });

export const demoAssistant = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({
    token: tokenSchema, segments: z.array(segmentSchema).max(120), question: z.string().trim().min(1).max(QUESTION_MAX_CHARS), language: languageSchema,
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(ASSISTANT_HISTORY_CHARS) })).max(ASSISTANT_HISTORY_MESSAGES),
  }).parse(input))
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const transcript = buildTranscript(data.segments, DEMO_ASSISTANT_BUDGET, true);
    const left = await quota('assistant', claims!.sid, ipHash);
    const { streamClinicalText } = await import('@/lib/ai/clinical.server');
    const result = streamClinicalText(secret(), [
      { role: 'system', content: `ДЕМО със синтетични данни. Ти си помощник за документация на лекар. Давай кратки предложения ${data.language === 'en' ? 'на английски' : 'на български'} (до 150 думи) само въз основа на предоставения разговор. Изрично обозначавай липсваща информация. Не поставяй самостоятелно диагнози и не предписвай терапия.` + langLine(data.language) },
      { role: 'user', content: `Разговор:\n${transcript || '(празен)'}` },
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

// Derived demo documents: only from reviewed report sections; shares the EXISTING assistant quota buckets.
const docSection = z.string().max(DOC_SECTION_MAX);
export const demoDocument = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => {
    const d = z.object({ token: tokenSchema, kind: z.enum(DOC_KINDS), language: z.enum(DOC_LANGS), sections: z.object({ anamneza: docSection, status: docSection, izsledvania: docSection, terapia: docSection }).strict() }).strict().parse(input);
    const c = checkDocumentInput(d.sections); // whole input, before quota/provider
    if (!c.ok) throw new Error(c.problem === 'empty' ? 'Няма прегледани раздели за документ.' : 'Отчетът е твърде дълъг за документ. Нищо не е изпратено.');
    return d;
  })
  .handler(async ({ data }) => {
    const { claims, ipHash } = await guard(data.token);
    const left = await quota('assistant', claims!.sid, ipHash);
    const s = data.sections;
    const source = `Анамнеза:\n${s.anamneza || '(празно)'}\n\nСтатус:\n${s.status || '(празно)'}\n\nИзследвания:\n${s.izsledvania || '(празно)'}\n\nТерапия:\n${s.terapia || '(празно)'}`;
    const { streamClinicalText } = await import('@/lib/ai/clinical.server');
    const result = streamClinicalText(secret(), [
      { role: 'system', content: documentPrompt(data.kind, data.language) },
      { role: 'user', content: `Прегледан отчет (единствен източник):\n${source}` },
    ], { maxOutputTokens: DOC_OUTPUT_CAP });
    const text = (await result.text).trim();
    if (!text || (await result.finishReason) === 'length') throw new Error('Документът не беше създаден. Опитайте отново.');
    return { text, remaining: left };
  });
