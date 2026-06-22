/**
 * OBS Studio adapter. Real implementation drives obs-websocket v5+;
 * Fake records call ordering for unit tests + dry-run smoke runs.
 */

import { dirname } from "node:path";
import OBSWebSocket from "obs-websocket-js";

export interface ObsAdapter {
  connect(): Promise<void>;
  startRecording(outputPath: string): Promise<void>;
  /** Stops recording and returns the path OBS actually wrote the file to. */
  stopRecording(): Promise<string>;
  disconnect(): Promise<void>;
}

export class FakeObsAdapter implements ObsAdapter {
  public calls: Array<[string, ...unknown[]]> = [];
  private lastPath = "";
  async connect(): Promise<void> {
    this.calls.push(["connect"]);
  }
  async startRecording(p: string): Promise<void> {
    this.lastPath = p;
    this.calls.push(["startRecording", p]);
  }
  async stopRecording(): Promise<string> {
    this.calls.push(["stopRecording"]);
    // The fake "records" exactly where asked, so the orchestrator's relocate
    // step is a no-op (recordedPath === masterPath) in dry-run.
    return this.lastPath;
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
      throw new Error(
        "OBS_WS_PASSWORD env var required for RealObsAdapter",
      );
    }
  }
  async connect(): Promise<void> {
    await this.obs.connect(this.url, this.password!, { rpcVersion: 1 });
  }
  async startRecording(outputPath: string): Promise<void> {
    // The old approach (SetProfileParameter AdvOut.FFFilePath) only applies to
    // the Advanced/FFmpeg output mode and is silently ignored in Simple mode —
    // so the file ended up in OBS's own configured folder, never at outRoot.
    // Point OBS's record directory at the run dir (best-effort; older OBS may
    // lack SetRecordDirectory), then rely on the post-StopRecord relocation —
    // which uses the real `outputPath` OBS reports — as the actual guarantee.
    try {
      await this.obs.call("SetRecordDirectory" as never, {
        recordDirectory: dirname(outputPath),
      } as unknown as never);
    } catch {
      // ignore — relocation after StopRecord covers it regardless
    }
    await this.obs.call("StartRecord");
  }
  async stopRecording(): Promise<string> {
    // obs-websocket v5 StopRecord returns the actual file path OBS wrote,
    // regardless of Simple vs Advanced output mode.
    const res = (await this.obs.call("StopRecord")) as { outputPath?: string };
    return res.outputPath ?? "";
  }
  async disconnect(): Promise<void> {
    await this.obs.disconnect();
  }
}
