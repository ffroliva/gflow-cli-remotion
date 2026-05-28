/**
 * A scripted terminal session for the promo, built from REAL gflow v0.9.1
 * output (captured 2026-05-28). Profile names, project ids, and local paths
 * from `gflow data list` are redacted/curated for public use — no fabricated
 * success output (a live generation needs auth + credits and is recorded
 * separately as the OBS master).
 */

export interface TerminalStep {
  /** The command after the `$ ` prompt. */
  command: string;
  /** Output lines printed by the command (already redacted/curated). */
  output: string[];
}

export const TERMINAL_SESSION: readonly TerminalStep[] = [
  {
    command: "gflow --version",
    output: ["gflow, version 0.9.1"],
  },
  {
    command: "gflow --help",
    output: [
      "Commands:",
      "  auth   Manage Google sessions for Flow.",
      "  data   Read local gflow media history.",
      "  image  Upload and generate images via Google Flow Imagen.",
      "  run    Execute a JSON-described batch of image generations.",
      "  video  Generate and manage videos via Google Flow Veo.",
    ],
  },
  {
    command: "gflow image t2i --help",
    output: [
      "Generate 1-4 images from a text prompt using Imagen.",
      "",
      "Examples:",
      '  gflow image t2i "a serene mountain lake at dawn"',
      '  gflow image t2i "neon cyberpunk alley" --model nano-pro --aspect 16:9',
      "  cat prompts.txt | gflow image t2i --stdin",
    ],
  },
  {
    command: "gflow data list images --limit 3",
    output: [
      "a calm forest at dawn          imagen4   16:9   2026-05-27",
      "neon cyberpunk alley           nano-pro  9:16   2026-05-27",
      "minimalist studio portrait     imagen4   1:1    2026-05-27",
    ],
  },
];
