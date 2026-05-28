#!/usr/bin/env tsx
/**
 * Render the promo matrix for a completed recording.
 *
 * Master + Social fan out per hook (A/B variants); ReadmeLoop renders once
 * (it ignores the hook). Output lands in ./out/promo/<runId>/.
 *
 * Phase 7 Task 7.1 of docs/superpowers/plans/2026-05-27-promo-pipeline.md.
 *
 * Usage:
 *   pnpm render-matrix --run-id 2026-05-28-001
 *   pnpm render-matrix --run-id smoke --only PromoSocial --frames 30
 */

import { parseArgs } from "node:util";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { hooks } from "../types/hooks";
import { resolveOutRoot } from "../src/orchestrator/run-paths";

const { values } = parseArgs({
  options: {
    "run-id": { type: "string" },
    only: { type: "string" },
    frames: { type: "string" },
  },
});

if (!values["run-id"]) {
  console.error("--run-id is required");
  process.exit(2);
}
const runId = values["run-id"];
const runDir = resolveOutRoot(runId);
const outRoot = join(process.cwd(), "out", "promo", runId);
mkdirSync(outRoot, { recursive: true });

const frameRange: [number, number] | undefined = values.frames
  ? [0, Math.max(0, Number(values.frames) - 1)]
  : undefined;

// composition id → output filename suffix (post-gif keys off "readme").
const SUFFIX: Record<string, string> = {
  PromoMaster: "master",
  PromoSocial: "social",
  ReadmeLoop: "readme",
};
// Master + Social vary per hook; ReadmeLoop renders once.
const PER_HOOK = new Set(["PromoMaster", "PromoSocial"]);

const wanted = ["PromoMaster", "PromoSocial", "ReadmeLoop"].filter(
  (c) => !values.only || c === values.only,
);
if (wanted.length === 0) {
  console.error(`--only '${values.only}' matched no composition`);
  process.exit(2);
}

// Serve the run dir as the bundle's public dir so staticFile("master.mp4")
// resolves to the recording over http (file:// is blocked by Chromium, and
// publicDir is a bundle-time option — not available on the render calls).
const serveUrl = await bundle({
  entryPoint: join(process.cwd(), "src", "remotion", "index.ts"),
  publicDir: runDir,
});

let count = 0;
for (const id of wanted) {
  const variants = PER_HOOK.has(id)
    ? hooks.map((h) => ({
        out: `${h.id}-${SUFFIX[id]}.mp4`,
        inputProps: {
          runDir,
          hookId: h.id,
          hookTitle: h.title,
          hookSubtitle: h.subtitle,
        },
      }))
    : [{ out: `${SUFFIX[id]}.mp4`, inputProps: { runDir } }];

  for (const v of variants) {
    const composition = await selectComposition({
      serveUrl,
      id,
      inputProps: v.inputProps,
    });
    const outputLocation = join(outRoot, v.out);
    console.log(`render ${id} → ${v.out}`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: v.inputProps,
      ...(frameRange ? { frameRange } : {}),
      chromiumOptions: { gl: "swiftshader" },
    });
    count += 1;
  }
}

console.log(`✓ rendered ${count} file(s) to ${outRoot}`);
process.exit(0);
