import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunManifest } from "../../types/schema";

const REPO_ROOT = join(__dirname, "..", "..");

interface RunEnv {
  profileRoot: string;
  outRoot: string;
  runId: string;
  envExtra: Record<string, string>;
}

function setupHermeticEnv(opts: { markerContent?: string | null } = {}): RunEnv {
  const profileRoot = mkdtempSync(join(tmpdir(), "promo-pr-"));
  const profileDir = join(profileRoot, "profile_promo-smoke");
  mkdirSync(profileDir, { recursive: true });
  if (opts.markerContent !== null) {
    writeFileSync(
      join(profileDir, ".gflow_browser_strategy"),
      opts.markerContent ?? "chrome",
    );
  }
  const outRoot = mkdtempSync(join(tmpdir(), "promo-out-"));
  const runId = "smoke-" + Date.now();
  return {
    profileRoot,
    outRoot,
    runId,
    envExtra: {
      GFLOW_PROFILE_ROOT: profileRoot,
      // Redirect ~/gflow-output to the tmp outRoot via USERPROFILE/HOME
      // so the script's outDir lands somewhere we can clean.
      USERPROFILE: outRoot,
      HOME: outRoot,
    },
  };
}

function runRecord(
  env: RunEnv,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "pnpm",
    ["tsx", "scripts/record-promo.mts", ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env.envExtra },
      encoding: "utf-8",
      shell: true,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("record-promo dry-run end-to-end", () => {
  let env: RunEnv;

  beforeEach(() => {
    env = setupHermeticEnv();
  });
  afterEach(() => {
    rmSync(env.profileRoot, { recursive: true, force: true });
    rmSync(env.outRoot, { recursive: true, force: true });
  });

  it("produces a valid run.json after a 4-phase dry-run tour", () => {
    const result = runRecord(env, [
      "--profile",
      "promo-smoke",
      "--run-id",
      env.runId,
      "--dry-run",
    ]);
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);

    const runDir = join(env.outRoot, "gflow-output", "promo", env.runId);
    expect(existsSync(join(runDir, "run.json"))).toBe(true);

    const manifest = RunManifest.parse(
      JSON.parse(readFileSync(join(runDir, "run.json"), "utf-8")),
    );
    expect(manifest.runId).toBe(env.runId);
    expect(manifest.profile).toBe("promo-smoke");
    expect(manifest.phases).toHaveLength(4);
    expect(manifest.phases.map((p) => p.kind)).toEqual([
      "t2i",
      "batch",
      "video",
      "data",
    ]);
    for (const p of manifest.phases) {
      expect(p.exitCode).toBe(0);
    }
    // The fake-gflow stubs emit JSONL we already exercise in unit tests;
    // here we just confirm at least one event made it through to the manifest.
    expect(
      manifest.phases.reduce((sum, p) => sum + p.events.length, 0),
    ).toBeGreaterThan(0);
  }, 60_000);

  it("refuses to overwrite an existing run.json without --force", () => {
    const args = [
      "--profile",
      "promo-smoke",
      "--run-id",
      env.runId,
      "--dry-run",
    ];
    expect(runRecord(env, args).status).toBe(0);
    const second = runRecord(env, args);
    expect(second.status).not.toBe(0);
    expect(second.stderr + second.stdout).toMatch(/already exists/);
  }, 90_000);

  it("succeeds on re-run with --force", () => {
    const args = [
      "--profile",
      "promo-smoke",
      "--run-id",
      env.runId,
      "--dry-run",
    ];
    expect(runRecord(env, args).status).toBe(0);
    expect(runRecord(env, [...args, "--force"]).status).toBe(0);
  }, 90_000);
});
