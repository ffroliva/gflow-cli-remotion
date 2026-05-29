#!/usr/bin/env tsx
/**
 * Phase-3 workflow capture harness.
 *
 * Spawns `scripts/capture/flow_workflow.py` which drives gflow_cli's
 * `FlowApiClient` through t2i -> i2i(ref=t2i) -> i2v(start=t2i, end=i2i) in
 * one persistent context — ONE Chrome window OBS films end-to-end. The
 * Python emits the cross-language sentinels from `src/orchestrator/sentinels.ts`:
 *
 *   [workflow] READY                        -> windowReady resolved; record starts
 *   [workflow] PHASE START <kind>           -> per-phase timestamp captured
 *   [workflow] PHASE END   <kind> <path>    -> per-phase artifact recorded
 *   [workflow] DONE                         -> recording stops
 *
 * The harness writes `run.json` to the outRoot with per-phase ranges so the
 * Remotion split scripts can extract t2i/i2i/video beats from the master.
 *
 * Usage:
 *   pnpm tsx scripts/record-workflow.mts --profile promo-denon82 \\
 *     --run-id stickman-workflow-001
 *
 *   # dry-run with the stub python — no credits, no browser:
 *   pnpm tsx scripts/record-workflow.mts --profile promo-denon82 \\
 *     --run-id wf-test --dry-run
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { scrubEnv } from "../src/orchestrator/env-scrub";
import { FakeObsAdapter, RealObsAdapter, type ObsAdapter } from "../src/orchestrator/obs";
import { recordSession } from "../src/orchestrator/obs-session";
import { resolveOutRoot } from "../src/orchestrator/run-paths";
import {
  DONE_SENTINEL,
  PHASE_END_PREFIX,
  PHASE_START_PREFIX,
  READY_SENTINEL,
  isPhaseKind,
  type PhaseKind,
} from "../src/orchestrator/sentinels";

const PROFILE_NAME_RE = /^promo-[A-Za-z0-9_-]+$/;
const RUN_ID_RE = /^[A-Za-z0-9._-]+$/;

interface CliValues {
  profile: string;
  "run-id"?: string;
  "ready-timeout-seconds": string;
  "dry-run": boolean;
}

const { values: rawValues } = parseArgs({
  options: {
    profile: { type: "string" },
    "run-id": { type: "string" },
    "ready-timeout-seconds": { type: "string", default: "120" },
    "dry-run": { type: "boolean", default: false },
  },
});
const values = rawValues as Partial<CliValues>;
const profile = values.profile;
if (!profile) {
  console.error("--profile is required");
  process.exit(2);
}
if (!PROFILE_NAME_RE.test(profile)) {
  console.error(`--profile '${profile}' must match ${PROFILE_NAME_RE}`);
  process.exit(2);
}
const runId = values["run-id"] ?? `workflow-${Date.now()}`;
if (!RUN_ID_RE.test(runId)) {
  console.error(`--run-id '${runId}' must match ${RUN_ID_RE}`);
  process.exit(2);
}
// 120s default: Chrome launch + Flow first-paint + the first ui_automation
// editor-attach can take 30-90s on a cold session. Raise via the flag for
// slow accounts; values <= 0 / NaN are rejected here (a NaN setTimeout
// fires immediately and would reject READY before python starts).
const readyTimeoutSec = Number(values["ready-timeout-seconds"] ?? 120);
if (!Number.isFinite(readyTimeoutSec) || readyTimeoutSec <= 0) {
  console.error(`--ready-timeout-seconds must be a positive number; got '${values["ready-timeout-seconds"]}'`);
  process.exit(2);
}
const dryRun = values["dry-run"] ?? false;

const outRoot = resolveOutRoot(runId);
mkdirSync(outRoot, { recursive: true });
const masterPath = join(outRoot, "master.mp4");

console.log(`[record-workflow] runId=${runId} dryRun=${dryRun}`);
console.log(`[record-workflow] master=${masterPath}`);

// --- Spawn the python driver ------------------------------------------------
// `shell: false` is deliberate (council finding #3 — see record-idle.mts for
// the full SIGINT-propagation rationale). env: scrubEnv drops OBS_WS_PASSWORD
// before the child sees it; the python child connects to Flow, not OBS.
const uvBin = process.platform === "win32" ? "uv.exe" : "uv";
const pythonArgs = [
  "run",
  "--with",
  "gflow-cli==0.10.0",
  "python",
  "scripts/capture/flow_workflow.py",
  "--profile",
  profile,
  "--out-root",
  outRoot,
];
if (dryRun) {
  pythonArgs.push("--dry-run");
}
// In dry-run, the python child does not need gflow-cli installed — use a
// stub fixture so the test runs in CI without pulling gflow's dep tree.
const stubFixture = join("tests", "fixtures", "fake-flow-workflow", process.platform === "win32" ? "stub.cmd" : "stub.sh");
const cmdToRun = dryRun && process.env.RECORD_WORKFLOW_USE_STUB === "1" ? stubFixture : uvBin;
const argsToRun = dryRun && process.env.RECORD_WORKFLOW_USE_STUB === "1" ? [outRoot] : pythonArgs;

const python = spawn(cmdToRun, argsToRun, {
  stdio: ["ignore", "pipe", "inherit"],
  env: scrubEnv(process.env),
  shell: dryRun && process.env.RECORD_WORKFLOW_USE_STUB === "1", // .cmd needs cmd.exe
});

process.on("SIGINT", () => {
  console.log("[record-workflow] SIGINT — forwarding to python child");
  python.kill("SIGINT");
});

// --- Parse sentinels --------------------------------------------------------
interface PhaseRecord {
  kind: PhaseKind;
  startedMs: number;
  endedMs: number;
  artifact: string | null;
}

const phaseStarts = new Map<PhaseKind, number>();
const phases: PhaseRecord[] = [];
const recordStartHr = process.hrtime.bigint();
const nowMs = (): number => Number((process.hrtime.bigint() - recordStartHr) / 1_000_000n);

let stdoutBuf = "";
let readyResolve: (() => void) | null = null;
let readyReject: ((e: Error) => void) | null = null;
const ready = new Promise<void>((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});
let doneResolve: (() => void) | null = null;
let doneReject: ((e: Error) => void) | null = null;
const done = new Promise<void>((resolve, reject) => {
  doneResolve = resolve;
  doneReject = reject;
});

const readyTimer = setTimeout(() => {
  readyReject?.(new Error(`READY sentinel not seen within ${readyTimeoutSec}s`));
}, readyTimeoutSec * 1000);

function handleSentinelLine(line: string): void {
  if (line === READY_SENTINEL) {
    clearTimeout(readyTimer);
    readyResolve?.();
    return;
  }
  if (line === DONE_SENTINEL) {
    doneResolve?.();
    return;
  }
  if (line.startsWith(PHASE_START_PREFIX)) {
    const kindRaw = line.slice(PHASE_START_PREFIX.length).trim();
    if (isPhaseKind(kindRaw)) {
      phaseStarts.set(kindRaw, nowMs());
    }
    return;
  }
  if (line.startsWith(PHASE_END_PREFIX)) {
    const rest = line.slice(PHASE_END_PREFIX.length).trim();
    const firstSpace = rest.indexOf(" ");
    const kindRaw = firstSpace === -1 ? rest : rest.slice(0, firstSpace);
    if (!isPhaseKind(kindRaw)) return;
    // Path may contain spaces — take everything after the first space as the
    // artifact path (no further splitting).
    const artifact = firstSpace === -1 ? null : rest.slice(firstSpace + 1);
    const startedMs = phaseStarts.get(kindRaw) ?? nowMs();
    phases.push({ kind: kindRaw, startedMs, endedMs: nowMs(), artifact });
  }
}

python.stdout.on("data", (b: Buffer) => {
  const text = b.toString("utf-8");
  process.stdout.write(text); // mirror
  stdoutBuf += text;
  let i: number;
  while ((i = stdoutBuf.indexOf("\n")) !== -1) {
    const line = stdoutBuf.slice(0, i).replace(/\r$/, "");
    stdoutBuf = stdoutBuf.slice(i + 1);
    handleSentinelLine(line);
  }
});
// Flush any unterminated remainder when stdout closes — without this, a final
// line like "[workflow] DONE" emitted without a trailing newline is silently
// lost (the harness then hangs on `done`).
python.stdout.on("end", () => {
  if (stdoutBuf.length > 0) {
    handleSentinelLine(stdoutBuf.replace(/\r?\n?$/, ""));
    stdoutBuf = "";
  }
});
python.on("exit", (code) => {
  if (code !== 0) {
    const err = new Error(`python exited code=${code} before completing workflow`);
    readyReject?.(err);
    doneReject?.(err);
  } else {
    // If python exits 0 without DONE (unlikely; defensive), unblock the wait.
    doneResolve?.();
  }
});

// --- Drive OBS through the recording cycle ----------------------------------
const obs: ObsAdapter = dryRun ? new FakeObsAdapter() : new RealObsAdapter();
let recordError: Error | null = null;

try {
  const { actualMasterPath } = await recordSession(
    { adapter: obs, masterPath, dryRun, windowReady: ready },
    async () => {
      console.log("[record-workflow] window READY — workflow running, recording");
      await done;
      console.log("[record-workflow] DONE sentinel observed — stopping recording");
    },
  );
  if (!dryRun && actualMasterPath !== masterPath) {
    console.log(`[record-workflow] master ${actualMasterPath} -> ${masterPath}`);
  }
} catch (e) {
  recordError = e instanceof Error ? e : new Error(String(e));
  console.error(`[record-workflow] FAILED: ${recordError.message}`);
  // Kill the python child immediately — otherwise it keeps spending paid
  // Flow generation credits on phases that nothing is recording. SIGTERM
  // first to let asyncio teardown run; SIGKILL after 3s if it ignores us.
  if (python.exitCode === null) {
    console.error("[record-workflow] killing python child to halt unrecorded credit spend");
    python.kill("SIGTERM");
    setTimeout(() => {
      if (python.exitCode === null) python.kill("SIGKILL");
    }, 3000);
  }
}

await new Promise<void>((resolve) => {
  if (python.exitCode !== null) resolve();
  else python.on("exit", () => resolve());
});

// Write the run manifest with per-phase ranges relative to record start.
const manifest = {
  schemaVersion: 1,
  runId,
  profile,
  dryRun,
  masterPath,
  phases,
};
writeFileSync(join(outRoot, "run.json"), JSON.stringify(manifest, null, 2));
console.log(`[record-workflow] wrote ${join(outRoot, "run.json")}`);

if (recordError) {
  process.exit(1);
}
process.exit(0);
