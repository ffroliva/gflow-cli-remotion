#!/usr/bin/env tsx
/**
 * Promo recording orchestrator.
 *
 * Drives one paid (or dry-run) gflow tour while OBS records the master video.
 * On exit, writes a Zod-validated run.json into the run dir alongside the
 * master.mp4. The Remotion compositions (Phase 6+) consume both.
 *
 * Phase 5 Task 5.7 of docs/superpowers/plans/2026-05-27-promo-pipeline.md.
 *
 * Usage:
 *   pnpm record-promo --profile promo-denon82 --run-id YYYY-MM-DD-001
 *   pnpm record-promo --profile promo-test --dry-run
 */

import { spawn } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { hrtime } from "node:process";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ulid } from "ulid";

import {
  FakeObsAdapter,
  RealObsAdapter,
  type ObsAdapter,
} from "../src/orchestrator/obs";
import { scrubEnv } from "../src/orchestrator/env-scrub";
import { parseEventStream } from "../src/orchestrator/event-stream";
import { verifyChromeProfile } from "../src/orchestrator/profile-check";
import { writeManifest } from "../src/orchestrator/manifest";
import { PHASES } from "../src/orchestrator/phases";
import { RunManifest } from "../types/schema";

interface CliValues {
  profile: string;
  "run-id"?: string;
  prompt: string;
  "dry-run": boolean;
  force: boolean;
}

const { values: rawValues } = parseArgs({
  options: {
    profile: { type: "string" },
    "run-id": { type: "string" },
    prompt: {
      type: "string",
      default: "a quiet mountain lake at dawn, cinematic, soft morning fog",
    },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});
const values = rawValues as Partial<CliValues>;

if (!values.profile) {
  console.error("--profile is required (e.g. --profile promo-denon82)");
  process.exit(2);
}
// §9.1 of the spec: profiles used for promo recordings must be prefixed
// `promo-` so credit-spending never lands on the operator's main profile.
if (!values.profile.startsWith("promo-")) {
  console.error(
    `--profile '${values.profile}' must start with 'promo-' (§9.1)`,
  );
  process.exit(2);
}

const profile = values.profile;
const dryRun = values["dry-run"] ?? false;
const force = values.force ?? false;
const prompt = values.prompt!;
const runId = values["run-id"] ?? ulid();

/**
 * Resolve gflow-cli's profile root in a way that mirrors Python platformdirs
 * `user_data_dir("gflow-cli", "ffroliva")` byte-for-byte — verified against
 * the gflow-cli auth module 2026-05-28.
 *   Windows: %LOCALAPPDATA%\ffroliva\gflow-cli\
 *   macOS:   ~/Library/Application Support/gflow-cli/
 *   Linux:   ~/.local/share/gflow-cli/
 * Profile dirs sit underneath as `profile_<full-name>` — the full operator-
 * supplied name (including the `promo-` prefix). Do NOT strip the prefix.
 *
 * Override hook: `GFLOW_PROFILE_ROOT` lets integration tests point the
 * orchestrator at a hermetic tmp dir without requiring the operator's real
 * profile layout. Consumed only by record-promo.mts; never passed to child
 * processes (scrubEnv drops it because it isn't allow-listed).
 */
function resolveProfileRoot(): string {
  if (process.env.GFLOW_PROFILE_ROOT) {
    return process.env.GFLOW_PROFILE_ROOT;
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA;
    if (!base) {
      throw new Error("LOCALAPPDATA env var missing on Windows host");
    }
    return join(base, "ffroliva", "gflow-cli");
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME env var missing");
  }
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "gflow-cli");
  }
  return join(home, ".local", "share", "gflow-cli");
}

function resolveProfileDir(profileName: string): string {
  return join(resolveProfileRoot(), `profile_${profileName}`);
}

const profileDir = resolveProfileDir(profile);
verifyChromeProfile(profileDir);

const outRoot =
  process.platform === "win32"
    ? join(process.env.USERPROFILE ?? "", "gflow-output", "promo", runId)
    : join(process.env.HOME ?? "", "gflow-output", "promo", runId);
mkdirSync(outRoot, { recursive: true });

const obs: ObsAdapter = dryRun ? new FakeObsAdapter() : new RealObsAdapter();
const masterPath = join(outRoot, "master.mp4");

const startedAtIso = new Date().toISOString();
const t0 = hrtime.bigint();
const nowMs = () => Number((hrtime.bigint() - t0) / 1_000_000n);

await obs.connect();
await obs.startRecording(masterPath);

const phaseRecords: Array<{
  kind: (typeof PHASES)[number]["kind"];
  cmd: string;
  startedMs: number;
  endedMs: number;
  exitCode: number;
  artifacts: string[];
  events: ReturnType<typeof parseEventStream>;
}> = [];

let aborted = false;
for (const phase of PHASES) {
  const args = phase.args({ prompt, profile, outDir: outRoot });
  const cmdLine = `${phase.cmd} ${args.join(" ")}`;

  // Dry-run: invoke the per-kind stub instead of real gflow.
  // The stub emits matching JSONL + writes a placeholder artifact.
  const stub =
    process.platform === "win32"
      ? join("tests", "fixtures", "fake-gflow", `${phase.kind}.cmd`)
      : join("tests", "fixtures", "fake-gflow", `${phase.kind}.sh`);
  const cmdToRun = dryRun ? stub : phase.cmd;
  const argsToRun = dryRun ? [outRoot] : args;

  const startedMs = nowMs();
  const eventLines: string[] = [];

  const child = spawn(cmdToRun, argsToRun, {
    env: scrubEnv(process.env),
    stdio: ["ignore", "pipe", "inherit"],
    shell: dryRun, // .cmd needs cmd.exe to dispatch on Windows
  });
  child.stdout.on("data", (b: Buffer) => {
    for (const line of b.toString("utf-8").split("\n")) {
      if (line.trim()) eventLines.push(line);
    }
  });

  let timedOut = false;
  const exitCode: number = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, phase.maxDurationMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
  const endedMs = nowMs();

  const artifacts = readdirSync(outRoot).filter((f) =>
    phase.expectedArtifactGlob.test(f),
  );
  phaseRecords.push({
    kind: phase.kind,
    cmd: cmdLine,
    startedMs,
    endedMs,
    exitCode,
    artifacts,
    events: parseEventStream(eventLines),
  });

  if (timedOut) {
    console.error(
      `phase ${phase.kind} exceeded maxDurationMs=${phase.maxDurationMs}; aborting tour`,
    );
    aborted = true;
    break;
  }
  if (exitCode !== 0) {
    console.error(
      `phase ${phase.kind} exited ${exitCode}; aborting downstream phases`,
    );
    aborted = true;
    break;
  }
}

await obs.stopRecording();
await obs.disconnect();

const manifest = RunManifest.parse({
  schemaVersion: 1,
  runId,
  startedAtIso,
  startedAtMonotonic: 0,
  profile,
  env: {
    gflowVersion: process.env.GFLOW_VERSION ?? "unknown",
    nodeVersion: process.version,
    obsVersion: process.env.OBS_VERSION ?? (dryRun ? "dry-run" : "unknown"),
    os: `${process.platform}-${process.arch}`,
    browserStrategy: "chrome",
  },
  phases: phaseRecords,
  recording: {
    source: "obs",
    masterPath,
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: nowMs(),
  },
});
writeManifest(outRoot, manifest, { force });

if (aborted) {
  console.error(`⚠  run ${runId} ended early; partial manifest at ${outRoot}`);
  process.exit(1);
}
console.log(`✓ recorded run.json + master.mp4 at ${outRoot}`);
process.exit(0);
