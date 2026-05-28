import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

function run(
  args: string[],
  env: Record<string, string | undefined> = {},
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    "pnpm",
    ["tsx", "scripts/record-promo.mts", ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      encoding: "utf-8",
      shell: true,
    },
  );
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

describe("record-promo error rows (spec §7)", () => {
  let profileRoot: string;
  let outRoot: string;

  beforeEach(() => {
    profileRoot = mkdtempSync(join(tmpdir(), "promo-err-pr-"));
    outRoot = mkdtempSync(join(tmpdir(), "promo-err-out-"));
  });
  afterEach(() => {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(outRoot, { recursive: true, force: true });
  });

  function setupProfile(name: string, markerContent: string | null): void {
    const dir = join(profileRoot, `profile_${name}`);
    mkdirSync(dir, { recursive: true });
    if (markerContent !== null) {
      writeFileSync(join(dir, ".gflow_browser_strategy"), markerContent);
    }
  }

  it("§9.1: rejects --profile that doesn't start with 'promo-'", () => {
    setupProfile("denon82", "chrome");
    const r = run(["--profile", "denon82", "--dry-run"], {
      GFLOW_PROFILE_ROOT: profileRoot,
      USERPROFILE: outRoot,
      HOME: outRoot,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/must start with 'promo-'/);
  }, 30_000);

  it("§6: aborts when .gflow_browser_strategy is missing", () => {
    setupProfile("promo-test", null);
    const r = run(["--profile", "promo-test", "--dry-run"], {
      GFLOW_PROFILE_ROOT: profileRoot,
      USERPROFILE: outRoot,
      HOME: outRoot,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/marker file/);
  }, 30_000);

  it("§6: aborts when marker says 'chromium'", () => {
    setupProfile("promo-test", "chromium");
    const r = run(["--profile", "promo-test", "--dry-run"], {
      GFLOW_PROFILE_ROOT: profileRoot,
      USERPROFILE: outRoot,
      HOME: outRoot,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/expected 'chrome'/);
  }, 30_000);

  it("§7: missing --profile exits 2 with usage hint", () => {
    const r = run(["--dry-run"], {
      GFLOW_PROFILE_ROOT: profileRoot,
      USERPROFILE: outRoot,
      HOME: outRoot,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--profile is required/);
  }, 30_000);
});
