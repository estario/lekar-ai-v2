// Demo-only UI: guided sample cases, progress, report presets and derived documents (in-memory).
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy, FileText, Printer, Sparkles } from 'lucide-react';
import { type SectionKey, type Session } from '@/lib/clinical';
import { scribeUi, localizeError, type Language } from '@/lib/i18n';
import { SCENARIO_IDS, SCENARIOS, type ScenarioId } from '@/lib/demo-scenarios';
import { DOC_KINDS, REPORT_STYLES, REPORT_TEMPLATES, applyDocResult, canExportDoc, checkDocumentInput, demoProgress, documentEligibility, editDoc, isDocStale, reportSnapshot, sourceRevisions, verifyDoc, type DocKind, type DocLang, type ReportStyle, type ReportTemplate, type SessionDocs } from '@/lib/demo-scribe';

export function ScenarioChooser({ language, onLoad }: { language: Language; onLoad: (id: ScenarioId) => void }) {
  const t = scribeUi[language];
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <h2 className="text-sm font-semibold">{t.tryTitle}</h2><p className="mt-1 text-xs text-muted-foreground">{t.trySub}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">{SCENARIO_IDS.map(id => <div key={id} className="flex flex-col justify-between gap-2 rounded-lg border border-border p-3">
      <div><p className="text-[13px] font-medium">{SCENARIOS[language][id].title}</p><p className="text-[11px] text-muted-foreground">{SCENARIOS[language][id].summary}</p></div>
      <Button size="sm" variant="outline" onClick={() => onLoad(id)}>{t.tryLoad}</Button></div>)}</div>
  </div>;
}

export function DemoProgress({ language, session, docs }: { language: Language; session: Session; docs: SessionDocs | undefined }) {
  const t = scribeUi[language]; const p = demoProgress(session, docs);
  const done = [p.conversation, p.report, p.review, p.documents];
  return <ol aria-label={t.progress} className="flex flex-wrap items-center gap-1.5 text-[11px]">{t.steps.map((s, i) => <li key={s} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${done[i] ? 'border-primary/40 bg-accent text-primary' : 'border-border text-muted-foreground'}`}>{done[i] ? <Check size={11} /> : <span className="font-mono">{i + 1}</span>}{s}</li>)}</ol>;
}

export function PresetPicker({ language, template, style, onChange, disabled }: { language: Language; template: ReportTemplate; style: ReportStyle; onChange: (t: ReportTemplate, s: ReportStyle) => void; disabled?: boolean }) {
  const t = scribeUi[language];
  const cls = 'h-7 rounded-md border border-input bg-card px-2 text-xs';
  return <div className="flex flex-wrap items-center gap-2 text-xs" aria-label={t.presetLabel}><span className="text-muted-foreground">{t.presetLabel}:</span>
    <select aria-label={t.templateLabel} className={cls} disabled={disabled} value={template} onChange={e => onChange(e.target.value as ReportTemplate, style)}>{REPORT_TEMPLATES.map(v => <option key={v} value={v}>{t.templates[v]}</option>)}</select>
    <select aria-label={t.styleLabel} className={cls} disabled={disabled} value={style} onChange={e => onChange(template, e.target.value as ReportStyle)}>{REPORT_STYLES.map(v => <option key={v} value={v}>{t.styles[v]}</option>)}</select>
  </div>;
}

type Generate = (args: { kind: DocKind; language: DocLang; sections: Record<SectionKey, string> }) => Promise<{ text: string; remaining: number }>;
export function DemoDocuments(props: {
  language: Language; session: Session; docs: SessionDocs | undefined; sectionLabels: Record<SectionKey, string>; remaining: number;
  busy: boolean; setBusy: (b: boolean) => void; getGen: () => number;
  updateDocs: (sessionId: string, fn: (d: SessionDocs) => SessionDocs) => void; getDocs: (sessionId: string) => SessionDocs;
  generate: Generate; onQuota: (n: number) => void; onError: (m: string) => void; onNotice: (m: string) => void;
}) {
  const { language, session, docs = {}, sectionLabels } = props; const t = scribeUi[language];
  const [kind, setKind] = useState<DocKind>('patient_summary');
  const [docLang, setDocLang] = useState<DocLang>(language);
  const [langTouched, setLangTouched] = useState(false);
  useEffect(() => { if (!langTouched) setDocLang(language); }, [language, langTouched]);
  const elig = documentEligibility(session);
  const doc = docs[kind]; const stale = doc ? isDocStale(doc, session) : false;
  const why = elig.ok ? '' : elig.reason === 'empty' ? t.docNeedReport : t.docNeedReview(elig.sections.map(k => sectionLabels[k]).join(', '));
  const exportText = (text: string) => `${t.docWatermark}\n${t.docSource}\n\n${text}`;

  async function run() {
    if (!elig.ok || props.busy) return;
    const sections = reportSnapshot(session); const sourceRevs = sourceRevisions(session);
    const c = checkDocumentInput(sections); if (!c.ok) { props.onError(t.docTooLong); return; }
    const gen = props.getGen(); const sessionId = session.id; const k = kind; const l = docLang;
    const startRev = props.getDocs(sessionId)[k]?.rev ?? null;
    props.setBusy(true);
    try {
      const r = await props.generate({ kind: k, language: l, sections });
      if (gen !== props.getGen()) return; // workspace ended/switched: discard silently
      props.onQuota(r.remaining);
      const res = applyDocResult(props.getDocs(sessionId), k, startRev, { kind: k, language: l, text: r.text, verified_at: null, source: sections, sourceRevs, invalidated: false, createdAt: new Date().toISOString() });
      if (!res.applied) { props.onNotice(t.docDiscarded); return; }
      props.updateDocs(sessionId, d => applyDocResult(d, k, startRev, res.docs[k]!).docs);
      props.onNotice(t.docReady);
    } catch (e) { if (gen === props.getGen()) props.onError(localizeError(language, e instanceof Error ? e.message : '', t.docFail)); }
    finally { if (gen === props.getGen()) props.setBusy(false); }
  }
  async function copyDoc() { if (!doc || !canExportDoc(doc, session)) return; try { await navigator.clipboard.writeText(exportText(doc.text)); props.onNotice(doc.verified_at ? t.docCopy + ' ✓' : t.docUnreviewed); } catch { props.onError(t.docFail); } }
  function printDoc() { if (!doc || !canExportDoc(doc, session)) return; document.body.dataset['printDoc'] = '1'; const off = () => { delete document.body.dataset['printDoc']; window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); window.print(); setTimeout(off, 1500); }

  return <article className="rounded-lg border border-border bg-card shadow-sm" aria-label={t.docsTitle}>
    <div className="border-b border-border px-4 py-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><FileText size={14} />{t.docsTitle}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{t.docsSub}</p></div>
    <div className="no-print flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
      <div role="tablist" className="flex flex-wrap gap-1">{DOC_KINDS.map(k => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-2.5 py-1 ${kind === k ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground'}`}>{t.docKinds[k]}</button>)}</div>
      <select aria-label={t.docLang} className="h-7 rounded-md border border-input bg-card px-2" value={docLang} onChange={e => { setLangTouched(true); setDocLang(e.target.value as DocLang); }}><option value="bg">BG</option><option value="en">EN</option></select>
      <Button size="sm" variant="outline" disabled={!elig.ok || props.busy || props.remaining <= 0} onClick={() => void run()}><Sparkles />{props.busy ? t.docGenerating : doc ? t.docRegenerate : t.docGenerate}</Button>
      <span className="text-[11px] text-muted-foreground">{t.docQuota(props.remaining)}</span>
    </div>
    {why && <p className="no-print px-4 pb-3 text-xs text-warning-foreground">{why}</p>}
    {doc && <div className="border-t border-border">
      <p className="px-4 pt-3 text-[11px] font-semibold text-destructive">{t.docWatermark} · <span className="font-normal text-muted-foreground">{t.docSource} · {doc.language.toUpperCase()}</span></p>
      {stale && <p role="status" className="px-4 pt-2 text-xs text-warning-foreground">{t.docStale}</p>}
      <Textarea aria-label={t.docKinds[doc.kind]} className="min-h-[180px] border-0 bg-transparent px-4 py-3 font-report text-[14px] leading-relaxed shadow-none focus-visible:ring-0" value={doc.text} onChange={e => { const v = e.target.value; props.updateDocs(session.id, d => d[kind] ? { ...d, [kind]: editDoc(d[kind]!, v) } : d); }} />
      <div className="no-print flex flex-wrap gap-2 border-t border-border px-4 py-3">
        <Button size="sm" variant={doc.verified_at ? 'secondary' : 'ghost'} disabled={stale} onClick={() => props.updateDocs(session.id, d => d[kind] ? { ...d, [kind]: verifyDoc(d[kind]!, d[kind]!.verified_at ? null : new Date().toISOString()) } : d)}><Check size={13} />{doc.verified_at ? t.docVerified : t.docVerify}</Button>
        <Button size="sm" variant="outline" disabled={stale} onClick={() => void copyDoc()}><Copy size={13} />{t.docCopy}</Button>
        <Button size="sm" variant="outline" disabled={stale} onClick={printDoc}><Printer size={13} />{t.docPrint}</Button>
      </div>
      <div className="print-only print-doc hidden"><p><strong>{t.docWatermark}</strong></p><p>{t.docSource}</p><h1>{t.docKinds[doc.kind]}</h1><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{doc.text}</pre></div>
    </div>}
  </article>;
}
