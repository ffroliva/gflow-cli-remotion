import { describe, it, expect, afterAll } from "vitest";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
// A tiny committed master.mp4 served as the publicDir, so staticFile("master.mp4")
// resolves over http exactly like a real render. Guards against the file://
// regression (Chromium rejects file:// on the localhost-served render page).
const PUBLIC_DIR = join(REPO_ROOT, "tests", "fixtures", "render-public");
const cleanup: string[] = [];

afterAll(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

describe("render smoke", () => {
  it(
    "renders PromoSocial across the master-video mount (frames 60-90)",
    async () => {
      const outDir = mkdtempSync(join(tmpdir(), "render-smoke-"));
      cleanup.push(outDir);

      // publicDir is a bundle-time option; staticFile("master.mp4") resolves
      // against it over http.
      const serveUrl = await bundle({
        entryPoint: join(REPO_ROOT, "src", "remotion", "index.ts"),
        publicDir: PUBLIC_DIR,
      });

      // Non-empty runDir → the composition mounts <Video src={staticFile(...)}>.
      const inputProps = {
        runDir: PUBLIC_DIR,
        hookId: "pov",
        hookTitle: "Your CLI talks to Veo.",
        hookSubtitle: "Watch.",
      };

      const composition = await selectComposition({
        serveUrl,
        id: "PromoSocial",
        inputProps,
      });

      const output = join(outDir, "smoke.mp4");
      // The social hook ends at frame 75; rendering 60-90 forces the Video to
      // mount, so a broken master URL fails the render here.
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: output,
        inputProps,
        frameRange: [60, 90],
        chromiumOptions: { gl: "swiftshader" },
      });

      expect(statSync(output).size).toBeGreaterThan(0);
    },
    180_000,
  );
});
