import { describe, it, expect } from "vitest";
import { PHASES } from "../../src/orchestrator/phases";

describe("PHASES", () => {
  const ctx = { prompt: "test prompt", profile: "promo-test", outDir: "/tmp/x" };

  it("defines exactly 4 phases", () => {
    expect(PHASES).toHaveLength(4);
  });

  it("each phase has a unique kind", () => {
    const kinds = PHASES.map((p) => p.kind);
    expect(new Set(kinds).size).toBe(4);
  });

  it("kinds are in tour order: t2i → batch → video → data", () => {
    expect(PHASES.map((p) => p.kind)).toEqual([
      "t2i",
      "batch",
      "video",
      "data",
    ]);
  });

  it("every phase carries a positive maxDurationMs cap", () => {
    for (const p of PHASES) {
      expect(p.maxDurationMs).toBeGreaterThan(0);
    }
  });

  it("t2i, batch, video receive the profile arg; data does not", () => {
    for (const p of PHASES) {
      const args = p.args(ctx);
      if (p.kind === "data") {
        expect(args).not.toContain("--profile");
      } else {
        expect(args).toContain("--profile");
        expect(args).toContain("promo-test");
      }
    }
  });

  it("video phase has the longest cap (Veo is the slowest)", () => {
    const video = PHASES.find((p) => p.kind === "video")!;
    for (const p of PHASES) {
      expect(video.maxDurationMs).toBeGreaterThanOrEqual(p.maxDurationMs);
    }
  });

  it("artifact glob matches expected file types", () => {
    expect("image-1.png").toMatch(PHASES[0]!.expectedArtifactGlob);
    expect("batch-3.jpg").toMatch(PHASES[1]!.expectedArtifactGlob);
    expect("video.mp4").toMatch(PHASES[2]!.expectedArtifactGlob);
    expect("image-1.png").not.toMatch(PHASES[3]!.expectedArtifactGlob); // data: no artifacts
  });
});
