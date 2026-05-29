/**
 * OBS Studio adapter. Real implementation drives obs-websocket v5+;
 * Fake records call ordering for unit tests + dry-run smoke runs.
 *
 * Capture model: a single `window_capture` source bound to the headed Flow
 * Chrome window — NOT a monitor/display capture. A window capture grabs only
 * that window's pixels even when it is occluded or unfocused, so concurrent
 * operator activity, the taskbar, and other windows never leak into the
 * master. The window title is resolved live at record time (see
 * ./window-match) because a browser title drifts and a frozen match renders
 * black.
 */

import { statSync } from "node:fs";

import OBSWebSocket from "obs-websocket-js";
import { pickWindow } from "./window-match";

/**
 * Wait until ``path``'s size has been the same on two consecutive samples,
 * or throw on timeout. obs-websocket v5 ``StopRecord`` returns the moment
 * OBS initiates the stop; the muxer finalization (moov atom, container
 * close) happens asynchronously, so an immediate read of the file can land
 * on a 0-byte or truncated capture. Polling the file size is dumb but
 * robust — no dependence on event-emitter typing.
 *
 * Exported so Phase-3 harnesses and tests can reuse it without reimplementing.
 */
export async function waitForStableSize(
  path: string,
  opts: { timeoutMs: number; intervalMs: number },
): Promise<void> {
  const start = Date.now();
  let lastSize = -1;
  let stableCount = 0;
  while (Date.now() - start < opts.timeoutMs) {
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      size = 0;
    }
    if (size > 0 && size === lastSize) {
      stableCount += 1;
      if (stableCount >= 2) return;
    } else {
      stableCount = 0;
      lastSize = size;
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new Error(
    `recording at ${path} did not finalize within ${opts.timeoutMs}ms`,
  );
}

export interface BrowserSceneOptions {
  /** Scene to (create and) make active. */
  sceneName: string;
  /** window_capture input name within the scene. */
  sourceName: string;
  /** Executable of the target window, e.g. "chrome.exe". */
  exe: string;
  /** Stable title substring of the target window, e.g. "Flow". */
  titleIncludes: string;
  /** Master canvas dimensions (16:9), e.g. 1920x1080. */
  width: number;
  height: number;
  /** Optional crop (px, relative) to strip browser chrome / banners. */
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
}

export interface ObsAdapter {
  connect(): Promise<void>;
  /**
   * Configure a clean window-capture scene for the target browser window and
   * make it the active program scene. Must run before startRecording (canvas
   * size cannot change while an output is active).
   */
  prepareBrowserScene(opts: BrowserSceneOptions): Promise<void>;
  /**
   * Start recording. The output path is determined by OBS's own configured
   * output mode (Simple Output / Advanced Output / Custom FFmpeg) — we do NOT
   * mutate the operator's profile to redirect it. The actual on-disk path is
   * returned by ``stopRecording()`` (obs-websocket v5 ``StopRecord`` response
   * carries ``outputPath``); the caller copies or renames to its desired
   * location.
   */
  startRecording(): Promise<void>;
  /** Stop recording and return the actual on-disk path of the produced file. */
  stopRecording(): Promise<string>;
  disconnect(): Promise<void>;
}

export class FakeObsAdapter implements ObsAdapter {
  public calls: Array<[string, ...unknown[]]> = [];
  async connect(): Promise<void> {
    this.calls.push(["connect"]);
  }
  async prepareBrowserScene(opts: BrowserSceneOptions): Promise<void> {
    this.calls.push(["prepareBrowserScene", opts.sceneName, opts.sourceName]);
  }
  async startRecording(): Promise<void> {
    this.calls.push(["startRecording"]);
  }
  async stopRecording(): Promise<string> {
    this.calls.push(["stopRecording"]);
    return "fake://master.mp4";
  }
  async disconnect(): Promise<void> {
    this.calls.push(["disconnect"]);
  }
}

export class RealObsAdapter implements ObsAdapter {
  private obs = new OBSWebSocket();
  constructor(
    private readonly url = "ws://127.0.0.1:4455",
    private readonly password = process.env.OBS_WS_PASSWORD,
  ) {
    if (!this.password) {
      throw new Error("OBS_WS_PASSWORD env var required for RealObsAdapter");
    }
  }
  async connect(): Promise<void> {
    await this.obs.connect(this.url, this.password!, { rpcVersion: 1 });
  }

  async prepareBrowserScene(opts: BrowserSceneOptions): Promise<void> {
    // 0) Self-heal: a previous capture that aborted may have left OBS in
    //    outputActive=true (the inner stopRecording sometimes doesn't reach
    //    the OBS WebSocket layer cleanly). Stop any leftover recording
    //    before SetVideoSettings — without this, the next run fails with
    //    "Video settings cannot be changed while an output is active" AFTER
    //    the python child has already emitted READY and is about to spend
    //    paid generation credits that nothing is recording. See memory
    //    `obs-state-leak-recovery`.
    const recStatus = (await this.obs.call("GetRecordStatus")) as { outputActive: boolean };
    if (recStatus.outputActive) {
      await this.obs.call("StopRecord");
      // Brief settle so the muxer release is visible to SetVideoSettings.
      await new Promise((r) => setTimeout(r, 500));
    }

    // 1) 16:9 master canvas. Cannot change while recording — callers run this
    //    before startRecording.
    await this.obs.call("SetVideoSettings", {
      baseWidth: opts.width,
      baseHeight: opts.height,
      outputWidth: opts.width,
      outputHeight: opts.height,
      fpsNumerator: 30,
      fpsDenominator: 1,
    });

    // 2) Ensure the scene exists.
    const scenes = await this.obs.call("GetSceneList");
    const haveScene = scenes.scenes.some(
      (s) => (s as { sceneName?: string }).sceneName === opts.sceneName,
    );
    if (!haveScene) {
      await this.obs.call("CreateScene", { sceneName: opts.sceneName });
    }

    // 3) Ensure a window_capture input exists in the scene (WGC method=2,
    //    cursor off). WGC reliably captures GPU-accelerated Chrome windows
    //    that BitBlt renders black.
    let sceneItemId: number;
    try {
      const got = await this.obs.call("GetSceneItemId", {
        sceneName: opts.sceneName,
        sourceName: opts.sourceName,
      });
      sceneItemId = got.sceneItemId;
    } catch {
      const created = await this.obs.call("CreateInput", {
        sceneName: opts.sceneName,
        inputName: opts.sourceName,
        inputKind: "window_capture",
        inputSettings: { method: 2, cursor: false, client_area: false },
        sceneItemEnabled: true,
      });
      sceneItemId = created.sceneItemId;
    }

    // 4) Resolve the LIVE window (title drifts → exact match goes black).
    const props = await this.obs.call("GetInputPropertiesListPropertyItems", {
      inputName: opts.sourceName,
      propertyName: "window",
    });
    const values = props.propertyItems.map((p) =>
      String((p as { itemValue?: unknown }).itemValue ?? ""),
    );
    const win = pickWindow(values, {
      exe: opts.exe,
      titleIncludes: opts.titleIncludes,
    });
    if (!win) {
      throw new Error(
        `no '${opts.exe}' window with title containing '${opts.titleIncludes}' is open; ` +
          `refusing to record (would capture the wrong window). Open the Flow tab and retry.`,
      );
    }
    await this.obs.call("SetInputSettings", {
      inputName: opts.sourceName,
      inputSettings: {
        window: win,
        method: 2,
        // priority 1: match title, else fall back to a same-class window so a
        // mid-recording title change does not black out the capture.
        priority: 1,
        cursor: false,
        client_area: false,
      },
      overlay: false,
    });

    // 5) Fit the window into the canvas, preserving aspect (letterbox).
    await this.obs.call("SetSceneItemTransform", {
      sceneName: opts.sceneName,
      sceneItemId,
      sceneItemTransform: {
        boundsType: "OBS_BOUNDS_SCALE_INNER",
        boundsAlignment: 0,
        boundsWidth: opts.width,
        boundsHeight: opts.height,
        positionX: 0,
        positionY: 0,
        alignment: 5,
      },
    });

    // 6) Optional crop to strip browser chrome / the automation banner.
    const hasCrop =
      !!(opts.cropTop || opts.cropBottom || opts.cropLeft || opts.cropRight);
    if (hasCrop) {
      const filterName = "promo-crop";
      try {
        await this.obs.call("RemoveSourceFilter", {
          sourceName: opts.sourceName,
          filterName,
        });
      } catch {
        // filter didn't exist yet — fine.
      }
      await this.obs.call("CreateSourceFilter", {
        sourceName: opts.sourceName,
        filterName,
        filterKind: "crop_filter",
        filterSettings: {
          relative: true,
          left: opts.cropLeft ?? 0,
          top: opts.cropTop ?? 0,
          right: opts.cropRight ?? 0,
          bottom: opts.cropBottom ?? 0,
        },
      });
    }

    // 7) Make it the active program scene.
    await this.obs.call("SetCurrentProgramScene", {
      sceneName: opts.sceneName,
    });
  }

  async startRecording(): Promise<void> {
    // Output path is OBS's own configured destination — we do NOT mutate the
    // operator's profile (the SetProfileParameter dance against AdvOut.FFFilePath
    // is a no-op unless they're on Custom FFmpeg output, and silently changes
    // their profile config when they're not). The actual on-disk file is
    // returned by stopRecording() below.
    await this.obs.call("StartRecord");
  }
  async stopRecording(): Promise<string> {
    // obs-websocket v5 StopRecord returns { outputPath: string } — the actual
    // file the recording landed in. Caller copies/renames to its target.
    const res = (await this.obs.call("StopRecord")) as { outputPath?: string };
    if (!res.outputPath) {
      throw new Error("OBS StopRecord did not return outputPath");
    }
    // StopRecord returns when OBS initiates the stop, NOT when the muxer has
    // finished writing the file. Wait for the file size to stabilize before
    // returning so the caller can safely copy/probe it.
    await waitForStableSize(res.outputPath, { timeoutMs: 10_000, intervalMs: 250 });
    return res.outputPath;
  }
  async disconnect(): Promise<void> {
    await this.obs.disconnect();
  }
}
