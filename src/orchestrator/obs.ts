/**
 * OBS Studio adapter. Real implementation drives obs-websocket v5+;
 * Fake records call ordering for unit tests + dry-run smoke runs.
 */

import OBSWebSocket from "obs-websocket-js";

export interface ObsAdapter {
  connect(): Promise<void>;
  startRecording(outputPath: string): Promise<void>;
  stopRecording(): Promise<void>;
  disconnect(): Promise<void>;
}

export class FakeObsAdapter implements ObsAdapter {
  public calls: Array<[string, ...unknown[]]> = [];
  async connect(): Promise<void> {
    this.calls.push(["connect"]);
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
      throw new Error(
        "OBS_WS_PASSWORD env var required for RealObsAdapter",
      );
    }
  }
  async connect(): Promise<void> {
    await this.obs.connect(this.url, this.password!, { rpcVersion: 1 });
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
