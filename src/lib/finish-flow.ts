// Finish-and-generate orchestration for a recording session. Success is decided BEFORE our own
// teardown bumps the lifecycle generation, so a successful Finish can still launch exactly one report,
// while a stale/replaced/ended session (generation, workspace epoch or session id changed) never does.
import type { RecordingLifecycle } from './recording-lifecycle';

export type FinishDeps = {
  lifecycle: RecordingLifecycle;
  /** Workspace/demo generation; changes on end demo, sign-out or unmount. */
  epoch(): number;
  stop(): Promise<unknown> | unknown;
  /** Flushes buffered final tokens into a transcript write (tracked in pending()). */
  flush(sessionId: string): void;
  pending(): Promise<unknown>[];
  failed(): boolean;
  persist(sessionId: string): Promise<void> | void;
  onError(e: unknown, sessionId: string): Promise<void> | void;
  teardown(): void;
};

export const STOP_FAILED = 'stop-failed';

export class FinishFlow {
  private finishing = false;
  private generating = new Set<string>();

  /** Returns the finished session id on full success (current, stopped, all writes saved), otherwise null. */
  async finish(d: FinishDeps, opts: { providerEnded?: boolean } = {}): Promise<string | null> {
    const lc = d.lifecycle, id = lc.sessionId;
    if (!id || this.finishing) return null;
    this.finishing = true;
    const gen = lc.gen, ep = d.epoch();
    const current = () => gen === lc.gen && ep === d.epoch() && lc.sessionId === id;
    let ok = false, success = false, stopFailed = false;
    try {
      if (!opts.providerEnded) { try { await d.stop(); } catch { stopFailed = true; } }
      if (!current()) return null;
      d.flush(id);
      await Promise.all(d.pending());
      if (!current()) return null;
      if (stopFailed) throw new Error(STOP_FAILED);
      if (d.failed()) throw new Error('segments-failed');
      await d.persist(id);
      if (!current()) return null;
      ok = !opts.providerEnded;
    } catch (e) {
      if (current()) await d.onError(e, id);
    } finally {
      success = ok && current();
      this.finishing = false;
      if (current()) d.teardown();
    }
    return success ? id : null;
  }

  /** User Finish / wall-cap finish: one report per successful finish, never overlapping per session. */
  async finishAndGenerate(d: FinishDeps, generate: (sessionId: string) => Promise<unknown> | unknown): Promise<boolean> {
    const ep = d.epoch();
    const id = await this.finish(d);
    if (!id || ep !== d.epoch() || this.generating.has(id)) return false;
    this.generating.add(id);
    try { await generate(id); } finally { this.generating.delete(id); }
    return true;
  }
}
