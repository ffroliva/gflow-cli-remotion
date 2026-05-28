#!/usr/bin/env tsx
/**
 * Convert the README loop render(s) to optimized GIFs.
 *
 * Pipes ffmpeg (y4m) → gifski via Node streams rather than a `sh -c` pipe so
 * it runs on a bare Windows host without git-bash. Operates on the
 * render-matrix output dir ./out/promo/<runId>/, converting every *readme.mp4.
 *
 * Phase 7 Task 7.2 of docs/superpowers/plans/2026-05-27-promo-pipeline.md.
 *
 * Requires ffmpeg + gifski on PATH.
 *
 * Usage: pnpm post-gif --run-id 2026-05-28-001
 */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "run-id": { type: "string" },
    fps: { type: "string", default: "12" },
    width: { type: "string", default: "960" },
    quality: { type: "string", default: "80" },
  },
});

if (!values["run-id"]) {
  console.error("--run-id is required");
  process.exit(2);
}

const dir = join(process.cwd(), "out", "promo", values["run-id"]);
const fps = values.fps!;
const width = values.width!;
const quality = values.quality!;

function toGif(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-vf",
        `fps=${fps},scale=${width}:-1:flags=lanczos`,
        "-f",
        "yuv4mpegpipe",
        "-",
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    const gifski = spawn(
      "gifski",
      ["-o", output, "--fps", fps, "--width", width, "--quality", quality, "-"],
      { stdio: ["pipe", "inherit", "inherit"] },
    );

    ff.on("error", (e) =>
      reject(new Error(`ffmpeg failed to start (is it on PATH?): ${e.message}`)),
    );
    gifski.on("error", (e) =>
      reject(new Error(`gifski failed to start (is it on PATH?): ${e.message}`)),
    );

    ff.stdout.pipe(gifski.stdin);

    let ffOk = false;
    ff.on("exit", (code) => {
      ffOk = code === 0;
      if (code !== 0) gifski.stdin.end();
    });
    gifski.on("exit", (code) => {
      if (code === 0 && ffOk) resolve();
      else reject(new Error(`gif conversion failed (ffmpeg/gifski exit)`));
    });
  });
}

let readmeFiles: string[];
try {
  readmeFiles = readdirSync(dir).filter((f) => /readme\.mp4$/i.test(f));
} catch {
  console.error(`render dir not found: ${dir} (run render-matrix first)`);
  process.exit(2);
}

if (readmeFiles.length === 0) {
  console.error(`no *readme.mp4 in ${dir}; nothing to convert`);
  process.exit(2);
}

for (const f of readmeFiles) {
  const input = join(dir, f);
  const output = input.replace(/\.mp4$/i, ".gif");
  console.log(`ffmpeg+gifski → ${output}`);
  await toGif(input, output);
}
console.log(`✓ converted ${readmeFiles.length} GIF(s) in ${dir}`);
process.exit(0);
