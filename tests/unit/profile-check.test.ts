import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyChromeProfile } from "../../src/orchestrator/profile-check";

describe("verifyChromeProfile()", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "promo-profile-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("passes when marker content is exactly 'chrome'", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "chrome");
    expect(() => verifyChromeProfile(tmp)).not.toThrow();
  });

  it("passes when marker has trailing whitespace/newline", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "chrome\n");
    expect(() => verifyChromeProfile(tmp)).not.toThrow();
  });

  it("throws when marker file is missing", () => {
    expect(() => verifyChromeProfile(tmp)).toThrow(/marker file/);
  });

  it("throws when marker says 'chromium'", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "chromium");
    expect(() => verifyChromeProfile(tmp)).toThrow(/expected 'chrome'/);
  });

  it("throws when marker is empty", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "");
    expect(() => verifyChromeProfile(tmp)).toThrow(/expected 'chrome'/);
  });

  it("includes the bad value in the error message", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "edge");
    expect(() => verifyChromeProfile(tmp)).toThrow(/'edge'/);
  });
});
