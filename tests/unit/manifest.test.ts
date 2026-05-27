import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeManifest } from "../../src/orchestrator/manifest";
import { RunManifest } from "../../types/schema";
import sample from "../fixtures/sample-run.json";

describe("writeManifest()", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "promo-manifest-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a Zod-valid run.json that round-trips", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    const bytes = readFileSync(join(dir, "run.json"), "utf-8");
    const round = RunManifest.parse(JSON.parse(bytes));
    expect(round).toEqual(parsed);
  });

  it("writes pretty-printed JSON with trailing newline", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    const bytes = readFileSync(join(dir, "run.json"), "utf-8");
    expect(bytes.endsWith("\n")).toBe(true);
    expect(bytes).toMatch(/\n  "schemaVersion"/); // 2-space indent
  });

  it("refuses to overwrite an existing run.json without force", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    expect(() => writeManifest(dir, parsed)).toThrow(/already exists/);
  });

  it("overwrites with force=true", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    expect(() => writeManifest(dir, parsed, { force: true })).not.toThrow();
    expect(existsSync(join(dir, "run.json"))).toBe(true);
  });

  it("re-validates with Zod and rejects post-parse mutation", () => {
    const parsed = RunManifest.parse(sample);
    // Force a violation past the type-system gate (caller mutated the object).
    (parsed as unknown as { schemaVersion: number }).schemaVersion = 999;
    expect(() => writeManifest(dir, parsed)).toThrow();
  });
});
