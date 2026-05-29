/**
 * Shared OBS recording-session helper used by `record-idle.mts` and (Phase 3)
 * `record-workflow.mts`. Extracted from the duplicated dance those harnesses
 * grew before Phase 2's council audit flagged the duplication.
 *
 * Lifecycle:
 *   connect → (await windowReady?) → prepareBrowserScene
 *     → startRecording → run() → stopRecording → copy → disconnect
 *
 * Errors thrown inside `run()` are propagated AFTER a best-effort stop +
 * disconnect, so the OBS state-machine is always cleaned up. The actual
 * on-disk recording path (which OBS picks based on the operator's own output
 * mode, see `obs.ts` rationale) is returned to the caller.
 */

import { copyFileSync } from "node:fs";

import type { BrowserSceneOptions, ObsAdapter } from "./obs";

/** Defaults applied if the caller does not override scene options. Picked to
 *  match the Phase-2 OBS-binding test that produced a valid 1920x1080 master. */
export const DEFAULT_BROWSER_SCENE: BrowserSceneOptions = {
  sceneName: "promo-browser",
  sourceName: "flow-capture",
  exe: "chrome.exe",
  titleIncludes: "Flow",
  width: 1920,
  height: 1080,
};

export interface RecordSessionOptions {
  adapter: ObsAdapter;
  /** Where the master should land. The actual OBS write goes to the operator's
   *  configured output dir; we copy to `masterPath` so the manifest's claim
   *  matches reality. Skipped in dry-run. */
  masterPath: string;
  /** When true, the post-stop copy is skipped — FakeObsAdapter returns a
   *  sentinel that does not exist on disk. */
  dryRun?: boolean;
  /** Per-scene overrides. Merged on top of DEFAULT_BROWSER_SCENE. */
  scene?: Partial<BrowserSceneOptions>;
  /** Resolves when the target window is on-screen and OBS can bind. Typical
   *  source is a Python child's READY-sentinel watcher. If omitted,
   *  prepareBrowserScene runs immediately (legacy record-promo behavior). */
  windowReady?: Promise<void>;
}

export interface RecordSessionResult {
  /** The path OBS actually wrote to (may differ from `masterPath` on the
   *  operator's machine). The copy step normalizes this for the manifest. */
  actualMasterPath: string;
}

/**
 * Drive an OBS adapter through one record cycle. Callers own the work that
 * happens DURING recording via the `run` callback (waiting for a child to
 * complete phases, sleeping for a fixed duration, etc.).
 */
export async function recordSession(
  opts: RecordSessionOptions,
  run: () => Promise<void>,
): Promise<RecordSessionResult> {
  const { adapter, masterPath, dryRun = false, scene, windowReady } = opts;
  const sceneOpts: BrowserSceneOptions = { ...DEFAULT_BROWSER_SCENE, ...scene };

  let actualMasterPath: string | null = null;
  let runError: Error | null = null;

  await adapter.connect();
  try {
    if (windowReady !== undefined) {
      await windowReady;
    }
    await adapter.prepareBrowserScene(sceneOpts);
    await adapter.startRecording();
    try {
      await run();
    } catch (e) {
      runError = e instanceof Error ? e : new Error(String(e));
    }
    // stopRecording can itself throw (waitForStableSize timeout on a recording
    // that never produced a file because run() crashed pre-frame). Don't let
    // that mask the ORIGINAL runError — the operator wants to see the Flow
    // failure, not the OBS-cleanup symptom.
    try {
      actualMasterPath = await adapter.stopRecording();
      if (!dryRun && actualMasterPath !== masterPath) {
        copyFileSync(actualMasterPath, masterPath);
      }
    } catch (stopErr) {
      if (runError === null) {
        runError = stopErr instanceof Error ? stopErr : new Error(String(stopErr));
      }
      // else: surface the run error; the stop error is a downstream effect.
    }
  } finally {
    try {
      await adapter.disconnect();
    } catch {
      // ignore — connect may have failed; best-effort cleanup only.
    }
  }

  if (runError !== null) {
    throw runError;
  }
  if (actualMasterPath === null) {
    throw new Error("recordSession: stopRecording returned no path");
  }
  return { actualMasterPath };
}
