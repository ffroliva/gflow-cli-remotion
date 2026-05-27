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
