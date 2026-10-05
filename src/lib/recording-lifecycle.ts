// Single owner of recorder/timer lifetime. Every async step captures a generation; teardown bumps it,
// cancels the recorder and clears timers so late callbacks/awaits become no-ops.
export type CancelableRecorder = { cancel(): void };
type Handle = ReturnType<typeof setInterval>;

export class RecordingLifecycle {
  gen = 0;
  sessionId: string | null = null;
  recorder: CancelableRecorder | null = null;
  providerStartedAt = 0;
  private timers = new Set<Handle>();
  constructor(private clear: (h: Handle) => void = h => clearInterval(h)) {}
  begin(sessionId: string) { this.gen += 1; this.sessionId = sessionId; this.providerStartedAt = 0; return this.gen; }
  isCurrent(gen: number, sessionId?: string) { return gen === this.gen && this.sessionId !== null && (sessionId === undefined || sessionId === this.sessionId); }
  /** Attaches a recorder only for the current generation; a stale recorder is cancelled immediately. */
  attach(gen: number, rec: CancelableRecorder) {
    if (!this.isCurrent(gen)) { try { rec.cancel(); } catch { /* ignore */ } return false; }
    this.recorder = rec; return true;
  }
  addTimer(h: Handle) { this.timers.add(h); return h; }
  removeTimer(h: Handle | null) { if (!h) return; this.clear(h); this.timers.delete(h); }
  get active() { return this.sessionId !== null; }
  teardown() {
    this.gen += 1;
    const r = this.recorder;
    this.recorder = null; this.sessionId = null; this.providerStartedAt = 0;
    for (const h of this.timers) this.clear(h);
    this.timers.clear();
    try { r?.cancel(); } catch { /* ignore */ }
  }
}

/** Provider wall clock (pauses included) against a hard session cap, with a safety margin. */
export const providerTimeExceeded = (startedAtMs: number, nowMs: number, limitSeconds: number, marginSeconds = 2) =>
  startedAtMs > 0 && limitSeconds > 0 && nowMs - startedAtMs >= (limitSeconds - marginSeconds) * 1000;
