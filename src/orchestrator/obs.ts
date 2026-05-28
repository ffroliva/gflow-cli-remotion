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

import OBSWebSocket from "obs-websocket-js";
import { pickWindow } from "./window-match";

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
  startRecording(outputPath: string): Promise<void>;
  stopRecording(): Promise<void>;
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
  async startRecording(p: string): Promise<void> {
    this.calls.push(["startRecording", p]);
  }
  async stopRecording(): Promise<void> {
    this.calls.push(["stopRecording"]);
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

  async startRecording(outputPath: string): Promise<void> {
    // obs-websocket v5: file path lives in the active profile under AdvOut.FFFilePath.
    // Typings don't expose the parameter shape; cast through `unknown` to avoid `any`.
    await this.obs.call("SetProfileParameter" as never, {
      parameterCategory: "AdvOut",
      parameterName: "FFFilePath",
      parameterValue: outputPath,
    } as unknown as never);
    await this.obs.call("StartRecord");
  }
  async stopRecording(): Promise<void> {
    await this.obs.call("StopRecord");
  }
  async disconnect(): Promise<void> {
    await this.obs.disconnect();
  }
}
