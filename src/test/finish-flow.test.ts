import { describe, expect, it, vi } from 'vitest';
import { FinishFlow, type FinishDeps } from '@/lib/finish-flow';
import { RecordingLifecycle } from '@/lib/recording-lifecycle';

// Fake recorder harness: stop() delivers the last final token, flush() turns buffered tokens into a
// tracked async transcript write, teardown() is the real lifecycle teardown (bumps generation).
function harness(opts: { stopFails?: boolean; stopDelay?: number } = {}) {
  const lc = new RecordingLifecycle(() => {});
  const gen = lc.begin('s1');
  let epoch = 0;
  const buffer: string[] = ['Здравейте.'];
  const transcript: string[] = [];
  const pending = new Set<Promise<unknown>>();
  let failed = false;
  const rec = { cancel: vi.fn(), stop: vi.fn(async () => {
    if (opts.stopDelay) await new Promise(r => setTimeout(r, opts.stopDelay));
    if (opts.stopFails) throw new Error('ws');
    buffer.push('Последна реплика.');
  }) };
  lc.attach(gen, rec);
  const teardown = vi.fn(() => lc.teardown());
  const onError = vi.fn();
  const deps: FinishDeps = {
    lifecycle: lc, epoch: () => epoch, stop: () => rec.stop(),
    flush: () => { const text = buffer.splice(0).join(' '); if (!text) return; const p = new Promise(r => setTimeout(r, 5)).then(() => { transcript.push(text); }); pending.add(p); p.finally(() => pending.delete(p)); },
    pending: () => [...pending], failed: () => failed, persist: async () => {}, onError, teardown,
  };
  const reports: string[][] = [];
  const generate = vi.fn(async () => { reports.push([...transcript]); });
  return { lc, deps, generate, reports, transcript, teardown, onError, rec, endDemo: () => { epoch += 1; lc.teardown(); }, setFailed: () => { failed = true; } };
}

describe('finish-and-generate orchestration', () => {
  it('success with teardown launches exactly one report containing the final token once', async () => {
    const h = harness(); const flow = new FinishFlow();
    expect(await flow.finishAndGenerate(h.deps, h.generate)).toBe(true);
    expect(h.teardown).toHaveBeenCalledOnce();
    expect(h.lc.active).toBe(false);
    expect(h.generate).toHaveBeenCalledOnce();
    expect(h.reports[0]).toEqual(['Здравейте. Последна реплика.']);
    expect(h.reports[0]!.join(' ').split('Последна реплика.').length - 1).toBe(1);
  });
  it('end demo / unmount during stop launches zero reports', async () => {
    const h = harness({ stopDelay: 20 }); const flow = new FinishFlow();
    const p = flow.finishAndGenerate(h.deps, h.generate);
    h.endDemo();
    expect(await p).toBe(false); expect(h.generate).not.toHaveBeenCalled();
    const h2 = harness({ stopDelay: 20 });
    const p2 = flow.finishAndGenerate(h2.deps, h2.generate);
    h2.lc.teardown(); // unmount teardown
    expect(await p2).toBe(false); expect(h2.generate).not.toHaveBeenCalled();
  });
  it('stop failure or failed transcript write launches zero reports and reports the error', async () => {
    const h = harness({ stopFails: true });
    expect(await new FinishFlow().finishAndGenerate(h.deps, h.generate)).toBe(false);
    expect(h.generate).not.toHaveBeenCalled(); expect(h.onError).toHaveBeenCalledOnce(); expect(h.lc.active).toBe(false);
    const h2 = harness(); h2.setFailed();
    expect(await new FinishFlow().finishAndGenerate(h2.deps, h2.generate)).toBe(false);
    expect(h2.generate).not.toHaveBeenCalled();
  });
  it('repeated Finish launches one report', async () => {
    const h = harness({ stopDelay: 10 }); const flow = new FinishFlow();
    const r = await Promise.all([flow.finishAndGenerate(h.deps, h.generate), flow.finishAndGenerate(h.deps, h.generate), flow.finishAndGenerate(h.deps, h.generate)]);
    expect(r.filter(Boolean)).toHaveLength(1); expect(h.generate).toHaveBeenCalledOnce(); expect(h.rec.stop).toHaveBeenCalledOnce();
  });
  it('wall-cap normal completion (same flow, timer-driven) launches one report', async () => {
    vi.useFakeTimers();
    const h = harness(); const flow = new FinishFlow();
    let done: Promise<boolean> | null = null;
    setTimeout(() => { done = flow.finishAndGenerate(h.deps, h.generate); }, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(50);
    vi.useRealTimers();
    expect(await done!).toBe(true); expect(h.generate).toHaveBeenCalledOnce();
  });
  it('provider-ended finish saves but never launches AI', async () => {
    const h = harness(); const flow = new FinishFlow();
    expect(await flow.finish(h.deps, { providerEnded: true })).toBeNull();
    expect(h.transcript).toEqual(['Здравейте.']); expect(h.lc.active).toBe(false);
  });
});
