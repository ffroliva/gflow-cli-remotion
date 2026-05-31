#!/usr/bin/env tsx
/**
 * Render the split-screen promo campaign set for a trimmed master.
 *
 * Sibling of render-matrix.mts (which stays as the legacy full-frame matrix).
 * This one drives the SplitPromo comps registered in Root.tsx across formats
 * (16:9 / 9:16 / 1:1 / 720p README loop) and layouts (terminal-top / bottom /
 * pip), with a curated hook subset per format to keep the software render
 * (~0.5s/frame, concurrency 1) under ~20 min.
 *
 * The master is read from ~/gflow-output/promo/<run-id>/master.mp4 via the
 * bundle publicDir (staticFile("master.mp4")); output lands in
 * ./out/promo/<run-id>/.  Default run-id is the trimmed master.
 *
 * Usage:
 *   pnpm tsx scripts/render-split.mts                      # full campaign
 *   pnpm tsx scripts/render-split.mts --only SplitSocial9x16
 *   pnpm tsx scripts/render-split.mts --still 120          # one PNG per job (fast)
 *   pnpm tsx scripts/render-split.mts --only SplitReadme --frames 30
 */

import { parseArgs } from "node:util";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { hooks } from "../types/hooks";
import { resolveOutRoot } from "../src/orchestrator/run-paths";

const { values } = parseArgs({
  options: {
    "run-id": { type: "string" },
    only: { type: "string" },
    hooks: { type: "string" }, // csv override of hook ids for per-hook jobs
    frames: { type: "string" }, // short video test: render frames [0, n-1]
    still: { type: "string" }, // render a single PNG at this frame, skip video
  },
});

const runId = values["run-id"] ?? "obs-real-005-trim15";
const runDir = resolveOutRoot(runId);
const outRoot = join(process.cwd(), "out", "promo", runId);
mkdirSync(outRoot, { recursive: true });

type Layout = "terminal-top" | "terminal-bottom" | "pip";
type Mode = "simultaneous" | "prompt-first";
interface Job {
  id: string;
  suffix: string;
  mode: Mode;
  layout: Layout;
  showHook: boolean;
  perHook: boolean;
  hooks?: string[];
}

// The browser demo is an Imagen IMAGE generation (t2i → jpg), so pair it with
// image/generic hooks — "question" ("Drive Veo and Imagen"), "pain" ("gflow
// runs the browser UI for you", literally what's on screen) and "before-after"
// ("gflow image batch"). The Veo/MP4-specific hooks (pov/outcome/claim) would
// misdescribe an image demo, so they're reserved for a future video master.
//
// v2 (obs-real-005-trim15): slower ~12.4s master + ~3s end hold. Each clip is
// now ~14-15.5s, so the set is curated (one hook per format) to keep the
// software render under ~30 min. Prompt-first comps carry no hook card (the
// terminal-typing lead is the intro), so they render one variant each.
const JOBS: Job[] = [
  // ── Simultaneous (terminal + browser together) ──
  // Hooks must match the on-screen command (single `image t2i`). "before-after"
  // ("gflow image batch") is NOT used here — it promises a batch the demo never
  // runs. Only command-aligned hooks: question ("Drive Veo and Imagen") + pain
  // ("gflow runs the browser UI for you").
  { id: "SplitMaster16x9", suffix: "master", mode: "simultaneous", layout: "terminal-top", showHook: true, perHook: true, hooks: ["question"] },
  { id: "SplitSocial9x16", suffix: "social", mode: "simultaneous", layout: "terminal-top", showHook: true, perHook: true, hooks: ["pain"] },
  { id: "SplitSquare1x1", suffix: "square", mode: "simultaneous", layout: "terminal-top", showHook: true, perHook: true, hooks: ["pain"] },
  { id: "SplitMasterPip", suffix: "master-pip", mode: "simultaneous", layout: "pip", showHook: true, perHook: true, hooks: ["question"] },
  // ── Prompt-first (type the command, then the browser slides in) ──
  { id: "SplitMasterPF", suffix: "master-pf", mode: "prompt-first", layout: "terminal-top", showHook: false, perHook: false },
  { id: "SplitSocialPF", suffix: "social-pf", mode: "prompt-first", layout: "terminal-top", showHook: false, perHook: false },
  { id: "SplitSquarePF", suffix: "square-pf", mode: "prompt-first", layout: "terminal-top", showHook: false, perHook: false },
  { id: "SplitMasterBottomPF", suffix: "master-bottom-pf", mode: "prompt-first", layout: "terminal-bottom", showHook: false, perHook: false },
];

const hookOverride = values.hooks?.split(",").map((s) => s.trim()).filter(Boolean);
const wanted = JOBS.filter((j) => !values.only || j.id === values.only);
if (wanted.length === 0) {
  console.error(`--only '${values.only}' matched no job`);
  process.exit(2);
}

const frameRange: [number, number] | undefined = values.frames
  ? [0, Math.max(0, Number(values.frames) - 1)]
  : undefined;
const stillFrame = values.still !== undefined ? Number(values.still) : undefined;

const serveUrl = await bundle({
  entryPoint: join(process.cwd(), "src", "remotion", "index.ts"),
  publicDir: runDir,
});

interface Variant {
  out: string;
  inputProps: Record<string, unknown>;
}

function variantsFor(job: Job): Variant[] {
  const baseProps = { runDir, mode: job.mode, layout: job.layout, showHook: job.showHook };
  if (!job.perHook) {
    return [{ out: job.suffix, inputProps: baseProps }];
  }
  const ids = hookOverride ?? job.hooks ?? [];
  return ids.map((hid) => {
    const h = hooks.find((x) => x.id === hid);
    if (!h) throw new Error(`unknown hook id '${hid}' for job ${job.id}`);
    return {
      out: `${h.id}-${job.suffix}`,
      inputProps: { ...baseProps, hookId: h.id, hookTitle: h.title, hookSubtitle: h.subtitle },
    };
  });
}

let count = 0;
for (const job of wanted) {
  for (const v of variantsFor(job)) {
    const composition = await selectComposition({
      serveUrl,
      id: job.id,
      inputProps: v.inputProps,
    });

    if (stillFrame !== undefined) {
      const output = join(outRoot, `${v.out}.f${stillFrame}.png`);
      console.log(`still ${job.id} f${stillFrame} → ${v.out}.f${stillFrame}.png`);
      await renderStill({
        composition,
        serveUrl,
        output,
        frame: stillFrame,
        inputProps: v.inputProps,
        chromiumOptions: { gl: "swiftshader" },
      });
      count += 1;
      continue;
    }

    const output = join(outRoot, `${v.out}.mp4`);
    console.log(`render ${job.id} → ${v.out}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: output,
      inputProps: v.inputProps,
      ...(frameRange ? { frameRange } : {}),
      chromiumOptions: { gl: "swiftshader" },
      timeoutInMilliseconds: 240_000,
      concurrency: 1,
    });
    count += 1;
  }
}

console.log(`✓ ${stillFrame !== undefined ? "stilled" : "rendered"} ${count} file(s) to ${outRoot}`);
process.exit(0);
