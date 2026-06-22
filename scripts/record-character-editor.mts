#!/usr/bin/env tsx
/**
 * Browser-only Flow Character Editor recorder (0 credits spent).
 *
 * Captures the Flow character editor UI natively using Playwright's video recording
 * feature, avoiding any OBS dependency. B-roll clips generated here can be used in
 * compositions.
 *
 * Usage:
 *   pnpm record-character-editor --profile promo-denon82 --project <project_id> --entity <character_entity_id> --seconds 22
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, Page } from "playwright";
import { verifyChromeProfile } from "../src/orchestrator/profile-check";

interface CliValues {
  profile: string;
  project: string;
  entity: string;
  locale: string;
  seconds: string;
  out?: string;
  headless: boolean;
}

const { values: rawValues } = parseArgs({
  options: {
    profile: { type: "string" },
    project: { type: "string" },
    entity: { type: "string" },
    locale: { type: "string", default: "pt" },
    seconds: { type: "string", default: "22" },
    out: { type: "string" },
    headless: { type: "boolean", default: false },
  },
});

const values = rawValues as CliValues;

if (!values.profile) {
  console.error("--profile is required (e.g. --profile promo-denon82)");
  process.exit(2);
}
if (!values.project) {
  console.error("--project is required (Flow project ID)");
  process.exit(2);
}
if (!values.entity) {
  console.error("--entity is required (existing Character Entity ID)");
  process.exit(2);
}

const profile = values.profile;
const projectId = values.project;
const entityId = values.entity;
const locale = values.locale;
const seconds = parseInt(values.seconds, 10) || 22;
const headless = values.headless;

const VIEWPORT = { width: 1280, height: 720 };
const READY_SELECTOR = 'div[role="textbox"][data-slate-editor="true"]';

function resolveProfileRoot(): string {
  if (process.env.GFLOW_PROFILE_ROOT) {
    return process.env.GFLOW_PROFILE_ROOT;
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA;
    if (!base) {
      throw new Error("LOCALAPPDATA env var missing on Windows host");
    }
    return join(base, "ffroliva", "gflow-cli");
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME env var missing");
  }
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "gflow-cli");
  }
  return join(home, ".local", "share", "gflow-cli");
}

function resolveProfileDir(profileName: string): string {
  return join(resolveProfileRoot(), `profile_${profileName}`);
}

const profileDir = resolveProfileDir(profile);
try {
  verifyChromeProfile(profileDir);
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}

const defaultOutDir = join(process.cwd(), "out", "promo");
const outPath = values.out ? join(process.cwd(), values.out) : join(defaultOutDir, `flow-capture-${Date.now()}.mp4`);
mkdirSync(dirname(outPath), { recursive: true });

const recTmpDir = join(dirname(outPath), "_rec_tmp");
mkdirSync(recTmpDir, { recursive: true });

function shortLocale(loc: string): string {
  return loc.trim().split("-")[0].toLowerCase() || "en";
}

async function gentleTour(page: Page, durationSeconds: number): Promise<void> {
  const endTime = Date.now() + durationSeconds * 1000;
  const width = VIEWPORT.width;
  const height = VIEWPORT.height;
  let phase = 0;

  while (Date.now() < endTime) {
    if (phase % 2 === 0) {
      await page.mouse.move(width * 0.5, height * 0.45, { steps: 18 });
      await page.mouse.wheel(0, 220);
    } else {
      await page.mouse.move(width * 0.4, height * 0.55, { steps: 18 });
      await page.mouse.wheel(0, -220);
    }
    await page.waitForTimeout(2200);
    phase += 1;
  }
}

function getNewestWebm(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) return null;
  const sorted = files
    .map((f) => ({
      name: f,
      time: statSync(join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);
  return join(dir, sorted[0].name);
}

function transcode(src: string, dst: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        src,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        dst,
      ],
      { stdio: ["ignore", "pipe", "inherit"] }
    );

    ff.on("error", (e) => {
      const fallback = dst.replace(/\.mp4$/i, ".webm");
      try {
        copyFileSync(src, fallback);
        console.warn(`[rec] Warning: ffmpeg failed to start (${e.message}). Kept raw WebM -> ${fallback}`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    ff.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg transcode exited with code ${code}`));
      }
    });
  });
}

async function run() {
  console.log(`[rec] Starting browser-only capture...`);
  console.log(`[rec] Profile dir: ${profileDir}`);
  console.log(`[rec] Output path: ${outPath}`);
  console.log(`[rec] NOTE: This run costs 0 credits (navigation + recording only).`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: VIEWPORT,
    locale,
    channel: "chrome",
    recordVideo: {
      dir: recTmpDir,
      size: VIEWPORT,
    },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--password-store=basic",
    ],
  });

  // Strip webdriver flag
  await context.addInitScript(
    "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})",
  );

  const page = context.pages()[0] || (await context.newPage());

  try {
    const segment = shortLocale(locale);
    const url = `https://labs.google/fx/${segment}/tools/flow/project/${projectId}/character/${entityId}`;
    console.log(`[rec] Navigating to: ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    try {
      await page.locator(READY_SELECTOR).first().waitFor({ state: "visible", timeout: 20000 });
      console.log("[rec] Editor ready (prompt textbox visible)");
    } catch {
      console.warn(`[rec] Warning: Editor-ready gate timed out; URL=${page.url()}`);
    }

    try {
      await page.keyboard.press("Escape");
    } catch {
      // ignore
    }

    await page.waitForTimeout(1500);
    await gentleTour(page, seconds);
  } finally {
    await context.close();
  }

  const webm = getNewestWebm(recTmpDir);
  if (!webm) {
    console.error("[rec] Error: No WebM file was generated by Playwright.");
    process.exit(1);
  }

  try {
    await transcode(webm, outPath);
    console.log(`[rec] Success: Video recorded and finalized -> ${outPath}`);
  } catch (err) {
    console.error(`[rec] Transcode failed: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    try {
      rmSync(recTmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error(`[rec] Execution failed: ${err.message}`);
  process.exit(1);
});
