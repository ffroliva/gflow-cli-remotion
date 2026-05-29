/**
 * Phase-3 council Must-Add #3 (Tests dimension): record-workflow.mts dry-run
 * end-to-end with the fake-flow-workflow stub. Mirrors the existing
 * `dry-run.test.ts` pattern for record-promo.mts.
 *
 * No Python, no uv, no playwright install — the stub is a small .cmd/.sh
 * script that emits the same sentinels flow_workflow.py --dry-run would
 * print. This locks the cross-language sentinel contract end-to-end and
 * catches regressions in the harness's sentinel parser without depending on
 * Python tooling in CI.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

interface WorkflowRunJson {
  schemaVersion: number;
  runId: string;
  profile: string;
  dryRun: boolean;
  masterPath: string;
  phases: Array<{
    kind: "t2i" | "i2i" | "video";
    startedMs: number;
    endedMs: number;
    artifact: string | null;
  }>;
}

describe("record-workflow dry-run end-to-end", () => {
  it("emits a 3-phase run.json via the stub fixture", () => {
    const outRoot = mkdtempSync(join(tmpdir(), "wf-out-"));
    const runId = "wf-smoke-" + Date.now();

    const result = spawnSync(
      "pnpm",
      [
        "tsx",
        "scripts/record-workflow.mts",
        "--profile",
        "promo-smoke",
        "--run-id",
        runId,
        "--dry-run",
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          // Routes record-workflow to the .cmd/.sh stub instead of the real
          // Python driver (which would need uv + gflow-cli installed).
          RECORD_WORKFLOW_USE_STUB: "1",
          // Force the FakeObsAdapter path — record-workflow's `dryRun ? Fake :
          // Real` switch already picks Fake, but constructing RealObsAdapter
          // would throw without OBS_WS_PASSWORD anyway. Belt and braces.
          OBS_WS_PASSWORD: "test-secret",
          // Redirect ~/gflow-output to a tmp dir so the harness's outRoot
          // composition lands somewhere we control + can clean.
          USERPROFILE: outRoot,
          HOME: outRoot,
        },
        encoding: "utf-8",
        shell: true,
      },
    );

    expect(result.status).toBe(0);

    // The harness writes outRoot via resolveOutRoot(runId) — reconstruct the
    // expected path from the env override.
    const runJsonPath = join(outRoot, "gflow-output", "promo", runId, "run.json");
    expect(existsSync(runJsonPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(runJsonPath, "utf-8")) as WorkflowRunJson;

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.runId).toBe(runId);
    expect(manifest.profile).toBe("promo-smoke");
    expect(manifest.dryRun).toBe(true);
    expect(manifest.phases.map((p) => p.kind)).toEqual(["t2i", "i2i", "video"]);
    for (const phase of manifest.phases) {
      expect(phase.endedMs).toBeGreaterThanOrEqual(phase.startedMs);
      expect(phase.artifact).not.toBeNull();
    }
  }, 60_000);
});
