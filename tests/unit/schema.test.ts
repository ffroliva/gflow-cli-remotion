import { describe, it, expect } from "vitest";
import { RunManifest } from "../../types/schema";
import sample from "../fixtures/sample-run.json";

describe("RunManifest schema", () => {
  it("accepts a known-good fixture", () => {
    const parsed = RunManifest.parse(sample);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.phases).toHaveLength(1);
  });
  it("rejects missing required field", () => {
    const { schemaVersion: _drop, ...bad } = sample;
    expect(() => RunManifest.parse(bad)).toThrow();
  });
  it("rejects unknown top-level extra key", () => {
    expect(() => RunManifest.parse({ ...sample, extra: 1 })).toThrow();
  });
  it("rejects empty phases array", () => {
    expect(() => RunManifest.parse({ ...sample, phases: [] })).toThrow();
  });
});
