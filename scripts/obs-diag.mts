#!/usr/bin/env tsx
import "dotenv/config";
import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();
await obs.connect("ws://127.0.0.1:4455", process.env.OBS_WS_PASSWORD!, { rpcVersion: 1 });

const s1 = await obs.call("GetRecordStatus");
console.log("before:", JSON.stringify(s1));

const stream = await obs.call("GetStreamStatus");
console.log("stream:", JSON.stringify(stream));

const ver = await obs.call("GetVersion");
console.log("obs:", (ver as { obsVersion?: string }).obsVersion);

if ((s1 as { outputActive?: boolean }).outputActive) {
  try {
    const stop = await obs.call("StopRecord");
    console.log("StopRecord ok:", JSON.stringify(stop));
  } catch (e) {
    console.log("StopRecord err:", (e as Error).message);
  }
  await new Promise((r) => setTimeout(r, 2000));
  const s2 = await obs.call("GetRecordStatus");
  console.log("after 2s:", JSON.stringify(s2));
}

await obs.disconnect();
