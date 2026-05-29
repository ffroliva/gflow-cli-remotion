#!/usr/bin/env tsx
/**
 * Phase-2 OBS-binding verification.
 *
 * Spawns `scripts/capture/flow_idle.py` so a real chrome.exe "Flow" window
 * appears on the promo profile, waits for the script's "window READY" stdout
 * sentinel, then drives OBS: prepareBrowserScene + startRecording + N seconds
 * + stopRecording. No Flow generation, no credits — proves that the binding
 * pipeline (RealObsAdapter -> window-match.ts -> OBS) actually produces a
 * non-black master for the live workflow Chrome window.
 *
 * If this run produces a clean master.mp4 showing the Flow editor, the real
 * workflow capture will too (same window lifetime, same OBS path).
 *
 * Usage:
 *   pnpm tsx scripts/record-idle.mts --profile promo-denon82 \
 *     --record-seconds 15 --run-id obs-binding-test-001
 */

import "dotenv/config"; // OBS_WS_PASSWORD from .env
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { scrubEnv } from "../src/orchestrator/env-scrub";
import { RealObsAdapter } from "../src/orchestrator/obs";
import { recordSession } from "../src/orchestrator/obs-session";
import { resolveOutRoot } from "../src/orchestrator/run-paths";

// Profile name must match `promo-<alnum/dash/underscore>` — same prefix rule
// as record-promo, plus a strict character class that blocks shell
// metacharacters (`;`, `$`, `&`, backticks) and path traversal (`..`, `/`,
// `\`) before the name flows into spawn args + a profile_dir join.
const PROFILE_NAME_RE = /^promo-[A-Za-z0-9_-]+$/;
// Same shape applied to operator-supplied run-id (composed into the OBS
// recording filename + the outRoot path).
const RUN_ID_RE = /^[A-Za-z0-9._-]+$/;

interface CliValues {
  profile: string;
  "run-id": string;
  "record-seconds": number;
  "ready-timeout-seconds": number;
}

const { values: rawValues } = parseArgs({
  options: {
    profile: { type: "string" },
    "run-id": { type: "string" },
    "record-seconds": { type: "string", default: "15" },
    "ready-timeout-seconds": { type: "string", default: "60" },
  },
});
const profile = (rawValues as Partial<CliValues>).profile;
if (!profile) {
  console.error("--profile is required (e.g. --profile promo-denon82)");
  process.exit(2);
}
if (!PROFILE_NAME_RE.test(profile)) {
  console.error(
    `--profile '${profile}' must match ${PROFILE_NAME_RE} ` +
      `(promo-<alnum/dash/underscore>, no shell metacharacters or path separators)`,
  );
  process.exit(2);
}
const runId = (rawValues as Partial<CliValues>)["run-id"] ?? `idle-${Date.now()}`;
if (!RUN_ID_RE.test(runId)) {
  console.error(`--run-id '${runId}' must match ${RUN_ID_RE}`);
  process.exit(2);
}
const recordSeconds = Number((rawValues as Partial<CliValues>)["record-seconds"] ?? 15);
const readyTimeout = Number((rawValues as Partial<CliValues>)["ready-timeout-seconds"] ?? 60);
if (
  !Number.isFinite(recordSeconds) ||
  recordSeconds <= 0 ||
  !Number.isFinite(readyTimeout) ||
  readyTimeout <= 0
) {
  console.error("--record-seconds and --ready-timeout-seconds must be positive numbers");
  process.exit(2);
}

// Total python idle budget: enough to cover (load + ready) + record + safety margin.
// Window opens 3-8s after spawn, then we record `recordSeconds`, then a 5s tail
// so the python's natural exit is the cleanup path (no kill-signalling gymnastics).
const pythonIdleSeconds = readyTimeout + recordSeconds + 5;

const outRoot = resolveOutRoot(runId);
mkdirSync(outRoot, { recursive: true });
const masterPath = join(outRoot, "master.mp4");

console.log(`[record-idle] runId=${runId}`);
console.log(`[record-idle] master=${masterPath}`);
console.log(`[record-idle] python idle budget=${pythonIdleSeconds}s, record=${recordSeconds}s`);

// Spawn the idle window script.
// - `shell: false` is deliberate. shell:true wraps via cmd.exe on Windows;
//   Ctrl+C on the harness then kills the shell but ORPHANS the python
//   grandchild, which keeps holding the profile SingletonLock until its idle
//   budget elapses. Direct spawn keeps signal propagation clean.
// - On Windows the .exe extension is needed when shell is false because
//   CreateProcess doesn't do PATHEXT lookup; on POSIX the bare name works.
// - env: scrubEnv(...) drops OBS_WS_PASSWORD (and any other secrets) before
//   the python child sees them — record-promo.mts does the same via the
//   `^OBS_WS` forbidden pattern in env-scrub.
const uvBin = process.platform === "win32" ? "uv.exe" : "uv";
const python = spawn(
  uvBin,
  [
    "run",
    "--with",
    "playwright",
    "python",
    "scripts/capture/flow_idle.py",
    "--profile",
    profile,
    "--seconds",
    String(pythonIdleSeconds),
  ],
  { stdio: ["ignore", "pipe", "inherit"], env: scrubEnv(process.env) },
);

// Forward SIGINT (Ctrl+C on this harness) to the python child so its own
// finally: ctx.close() runs and the profile lock is released. Without this,
// Node would propagate SIGINT only to its immediate child — fine in this
// non-shell spawn for the python process itself, but the explicit forward
// makes the contract obvious for Phase 3's harness that will copy this.
process.on("SIGINT", () => {
  console.log("[record-idle] SIGINT received — forwarding to python child");
  python.kill("SIGINT");
});

// Watch stdout for the READY sentinel. The python prints
//   [flow_idle] window READY  title='Flow'
// after page.goto(FLOW_URL) returns and the page title is resolved.
const ready = new Promise<void>((resolve, reject) => {
  let buf = "";
  const timer = setTimeout(() => {
    reject(new Error(`window did not become READY within ${readyTimeout}s`));
  }, readyTimeout * 1000);
  python.stdout.on("data", (b: Buffer) => {
    const text = b.toString("utf-8");
    process.stdout.write(text); // mirror python output to our stdout
    buf += text;
    if (buf.includes("window READY")) {
      clearTimeout(timer);
      resolve();
    }
  });
  python.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`python exited (code ${code}) before READY`));
  });
});

const pythonExit = new Promise<number>((resolve) => {
  python.on("exit", (code) => resolve(code ?? 1));
});

const obs = new RealObsAdapter();
let recordError: Error | null = null;

try {
  const { actualMasterPath } = await recordSession(
    { adapter: obs, masterPath, windowReady: ready },
    async () => {
      console.log(`[record-idle] recording for ${recordSeconds}s -> ${masterPath}`);
      await new Promise((r) => setTimeout(r, recordSeconds * 1000));
    },
  );
  if (actualMasterPath !== masterPath) {
    console.log(`[record-idle] copied master ${actualMasterPath} -> ${masterPath}`);
  }
} catch (e) {
  recordError = e instanceof Error ? e : new Error(String(e));
  console.error(`[record-idle] FAILED: ${recordError.message}`);
}

// Wait for python to exit on its own idle expiry (clean context.close()).
console.log("[record-idle] waiting for python to exit naturally...");
const code = await pythonExit;
console.log(`[record-idle] python exited code=${code}`);

if (recordError) {
  process.exit(1);
}
console.log(`[record-idle] ✓ DONE — verify ${masterPath} shows the Flow window (not black).`);
process.exit(0);
