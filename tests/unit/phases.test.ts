import { describe, it, expect } from "vitest";
import { PHASES, selectPhases } from "../../src/orchestrator/phases";

describe("PHASES", () => {
  const ctx = {
    prompt: "test prompt",
    profile: "promo-test",
    outDir: "/tmp/x",
    projectId: "proj-123",
  };

  it("defines exactly 5 phases", () => {
    expect(PHASES).toHaveLength(5);
  });

  it("each phase has a unique kind", () => {
    const kinds = PHASES.map((p) => p.kind);
    expect(new Set(kinds).size).toBe(5);
  });

  it("kinds are in tour order: t2i → batch → video → data → character", () => {
    expect(PHASES.map((p) => p.kind)).toEqual([
      "t2i",
      "batch",
      "video",
      "data",
      "character",
    ]);
  });

  it("every phase carries a positive maxDurationMs cap", () => {
    for (const p of PHASES) {
      expect(p.maxDurationMs).toBeGreaterThan(0);
    }
  });

  it("t2i, batch, video, character receive the profile arg; data does not", () => {
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

  describe("selectPhases", () => {
    it("returns all phases in canonical order when no kinds requested", () => {
      expect(selectPhases().map((p) => p.kind)).toEqual([
        "t2i",
        "batch",
        "video",
        "data",
        "character",
      ]);
      expect(selectPhases(undefined).map((p) => p.kind)).toEqual(
        PHASES.map((p) => p.kind),
      );
    });

    it("filters to a single requested kind", () => {
      expect(selectPhases(["character"]).map((p) => p.kind)).toEqual([
        "character",
      ]);
    });

    it("filters to multiple requested kinds, preserving canonical order", () => {
      // request out of order — result must still follow tour order
      expect(selectPhases(["character", "t2i"]).map((p) => p.kind)).toEqual([
        "t2i",
        "character",
      ]);
    });

    it("de-duplicates repeated kinds", () => {
      expect(selectPhases(["t2i", "t2i"]).map((p) => p.kind)).toEqual(["t2i"]);
    });

    it("throws a clear error listing valid kinds on an unknown kind", () => {
      expect(() => selectPhases(["bogus"])).toThrowError(/unknown phase/i);
      expect(() => selectPhases(["bogus"])).toThrowError(/t2i/);
      expect(() => selectPhases(["t2i", "nope"])).toThrowError(/nope/);
    });
  });

  describe("character phase", () => {
    const character = () => PHASES.find((p) => p.kind === "character")!;

    it("invokes `gflow character create`", () => {
      const p = character();
      const args = p.args(ctx);
      expect(p.cmd).toBe("gflow");
      expect(args.slice(0, 2)).toEqual(["character", "create"]);
    });

    it("threads the required --project <pid>", () => {
      const args = character().args(ctx);
      const i = args.indexOf("--project");
      expect(i).toBeGreaterThanOrEqual(0);
      expect(args[i + 1]).toBe("proj-123");
    });

    it("passes a name, face-prompt, voice, personality and model", () => {
      const args = character().args(ctx);
      for (const flag of [
        "--name",
        "--face-prompt",
        "--voice",
        "--personality",
        "--model",
      ]) {
        expect(args).toContain(flag);
      }
      expect(args[args.indexOf("--model") + 1]).toBe("nano2");
    });

    it("pins --locale pt (denon82 account locale; en-US 404s the editor URL)", () => {
      const args = character().args(ctx);
      const i = args.indexOf("--locale");
      expect(i).toBeGreaterThanOrEqual(0);
      expect(args[i + 1]).toBe("pt");
    });

    it("does NOT pass --out (gflow character create has no such flag)", () => {
      // gflow 0.12.0 `character create` persists reference images into the
      // entity/data store; it has no `--out` option. Passing one exits 2.
      expect(character().args(ctx)).not.toContain("--out");
    });

    it("expects no local artifact (OBS master.mp4 is the asset)", () => {
      const p = character();
      // character create writes nothing to outDir, so the glob matches nothing.
      expect("character-face.jpg").not.toMatch(p.expectedArtifactGlob);
      expect("character-body.png").not.toMatch(p.expectedArtifactGlob);
    });
  });
});
