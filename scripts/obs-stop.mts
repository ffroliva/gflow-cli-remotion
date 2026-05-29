#!/usr/bin/env tsx
/**
 * One-shot OBS diagnostic + stop. Connects to obs-websocket, reports the
 * recording state, and calls StopRecord if a recording is active. Use after
 * a record-workflow / record-promo run aborts mid-recording so OBS doesn't
 * carry a stale active-output state into the next run (which would fail at
 * SetVideoSettings with "Video settings cannot be changed while an output
 * is active").
 */
import "dotenv/config";
import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();
const password = process.env.OBS_WS_PASSWORD;
if (!password) {
  console.error("OBS_WS_PASSWORD missing from .env");
  process.exit(2);
}

await obs.connect("ws://127.0.0.1:4455", password, { rpcVersion: 1 });
const status = (await obs.call("GetRecordStatus")) as {
  outputActive: boolean;
  outputPaused: boolean;
  outputTimecode: string;
  outputDuration: number;
};
console.log("[obs-stop] state:", JSON.stringify(status));
if (status.outputActive) {
  console.log("[obs-stop] StopRecord ...");
  const res = (await obs.call("StopRecord")) as { outputPath?: string };
  console.log(`[obs-stop] stopped; outputPath=${res.outputPath ?? "?"}`);
}
await obs.disconnect();
console.log("[obs-stop] disconnected");
