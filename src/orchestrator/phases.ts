/**
 * The 5-phase promo tour: t2i → batch → video → data → character.
 *
 * Each phase carries the cmd/args template, a maxDurationMs hard cap
 * (defence against a hung Flow request bleeding the whole run), and a
 * regex matching the artifacts the orchestrator should pick up from
 * outDir after the phase exits cleanly.
 *
 * The `character` phase is special: `gflow character create` REQUIRES a
 * `--project <pid>` — Characters are per-project Flow entities. The
 * orchestrator resolves a project id once (see record-promo.mts) and threads
 * it through PhaseContext.projectId so the same value reaches the wire command.
 */

import type { PhaseKind } from "../../types/schema";

export interface PhaseContext {
  prompt: string;
  profile: string;
  outDir: string;
  /**
   * Flow project id for the `character` phase. `gflow character create` cannot
   * run without it. Other phases ignore the field. In a dry-run the value is a
   * harmless placeholder; for a live recording the operator supplies a real
   * project id via GFLOW_PROMO_PROJECT_ID (a preceding `gflow project create
   * --json` is the recommended way to obtain one — see docs/RECORDING.md).
   */
  projectId: string;
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
  {
    // `gflow character create` builds a reusable Character entity: a face
    // reference (slot 0) plus a front/side/back triptych body (slot 1), bound
    // to the project. Two image generations → the longest non-video phase.
    kind: "character",
    cmd: "gflow",
    args: ({ profile, outDir, projectId }) => [
      "character",
      "create",
      "--project",
      projectId,
      "--name",
      "Marina",
      "--face-prompt",
      "a woman with short dark hair, round glasses, navy sweater, soft studio portrait",
      "--voice",
      "Kore",
      "--personality",
      "calm, precise, dry wit",
      "--model",
      "nano2",
      "--profile",
      profile,
      "--out",
      outDir,
    ],
    maxDurationMs: 360_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
];
