/**
 * The 4-phase promo tour: t2i → batch → video → data.
 *
 * Each phase carries the cmd/args template, a maxDurationMs hard cap
 * (defence against a hung Flow request bleeding the whole run), and a
 * regex matching the artifacts the orchestrator should pick up from
 * outDir after the phase exits cleanly.
 */

import type { PhaseKind } from "../../types/schema";

export interface PhaseContext {
  prompt: string;
  profile: string;
  outDir: string;
  /** Absolute path to the previous phase's produced image (pipeline chaining). */
  prevArtifact?: string;
  /**
   * Absolute path to the FIRST image produced in the pipeline (t2i output).
   * Used as the i2v start frame when `--end-image` (prevArtifact/i2i) is set,
   * so Flow interpolates dark-dawn → sunrise rather than animating one image.
   * Only set by record-promo when running --pipeline; undefined otherwise.
   */
  firstArtifact?: string;
}

export interface PhaseDef {
  kind: PhaseKind;
  cmd: string;
  args: (ctx: PhaseContext) => string[];
  maxDurationMs: number;
  expectedArtifactGlob: RegExp;
}

export const PHASES: readonly PhaseDef[] = [
  {
    kind: "t2i",
    cmd: "gflow",
    args: ({ prompt, profile, outDir }) => [
      "image",
      "t2i",
      prompt,
      "--aspect",
      "16:9",
      "--profile",
      profile,
      "--out",
      outDir,
    ],
    maxDurationMs: 180_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "batch",
    cmd: "gflow",
    args: ({ profile, outDir }) => [
      "run",
      "--config",
      "examples/promo-batch.json",
      "--profile",
      profile,
      "--out",
      outDir,
    ],
    maxDurationMs: 360_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "video",
    cmd: "gflow",
    args: ({ prompt, profile, outDir }) => [
      "video",
      "t2v",
      prompt,
      "--model",
      "veo3",
      "--profile",
      profile,
      "--out",
      outDir,
    ],
    maxDurationMs: 420_000,
    expectedArtifactGlob: /\.mp4$/i,
  },
  {
    kind: "data",
    cmd: "gflow",
    args: () => ["data", "list", "images", "--limit", "6"],
    maxDurationMs: 30_000,
    expectedArtifactGlob: /^$/, // stdout-only; no artifacts written
  },
];

// ── Pipeline tour: t2i → i2i → i2v (the "Compiled Growth" stickman) ───────────
//
// A chained creative workflow: the t2i image seeds the i2i edit, whose output
// seeds the i2v animation. record-promo (with --pipeline) feeds each phase's
// produced image to the next via ctx.prevArtifact. Subject + style from the
// showcase runbook (~/Videos/gflow-cli-showcase/2026-05-26/00-plan). Vertical
// 9:16; image model nano-pro, video model omni-flash (per the runbook).

const STICKMAN_T2I =
  "A bold minimalist motivational stickman character, recurring mascot for a " +
  "channel called Compiled Growth, waking at 5 AM before sunrise in a quiet " +
  "city apartment. Simple black ink line body with expressive posture, round " +
  "head, tiny determined eyes, subtle warm gold rim light, desk lamp, open " +
  "notebook, coffee steam, window showing a dark blue pre-dawn city. Cinematic " +
  "vertical poster frame, clean high contrast, inspiring and mature, not " +
  "childish, no text, no logos, no watermark.";

const STICKMAN_I2I =
  "Same minimalist black ink stickman and apartment, now standing and " +
  "stretching with quiet determination as golden sunrise light floods through " +
  "the window. Warmer, brighter, more triumphant; same clean high-contrast " +
  "vertical poster style. No text, no logos, no watermark.";

const STICKMAN_MOTION =
  "The stickman rises and stretches with quiet determination, coffee steam " +
  "drifting, the golden sunrise glow slowly strengthening through the window; " +
  "gentle cinematic push-in, subtle, premium.";

export const PIPELINE_PHASES: readonly PhaseDef[] = [
  {
    kind: "t2i",
    cmd: "gflow",
    args: ({ profile, outDir }) => [
      "image", "t2i", STICKMAN_T2I,
      "--aspect", "9:16",
      "--model", "nano-pro",
      "--count", "1",
      "--profile", profile,
      "--out", outDir,
    ],
    maxDurationMs: 180_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "i2i",
    cmd: "gflow",
    args: ({ profile, outDir, prevArtifact }) => [
      "image", "i2i", STICKMAN_I2I,
      "--ref", prevArtifact ?? "",
      "--aspect", "9:16",
      "--model", "nano-pro",
      "--count", "1",
      "--profile", profile,
      "--out", outDir,
    ],
    maxDurationMs: 180_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "video",
    cmd: "gflow",
    args: ({ profile, outDir, prevArtifact, firstArtifact }) => {
      // Require both frames — fail fast rather than silently degrade.
      if (!firstArtifact) throw new Error("i2v: firstArtifact (t2i output) is required");
      if (!prevArtifact) throw new Error("i2v: prevArtifact (i2i output) is required");
      if (firstArtifact === prevArtifact) throw new Error("i2v: start and end frames are the same file");
      return [
        "video", "i2v", firstArtifact, STICKMAN_MOTION,
        "--end-image", prevArtifact,
        "--aspect", "9:16",
        "--model", "veo-fast",
        "--profile", profile,
        "--out-dir", outDir,
      ];
    },
    maxDurationMs: 420_000,
    expectedArtifactGlob: /\.mp4$/i,
  },
];
