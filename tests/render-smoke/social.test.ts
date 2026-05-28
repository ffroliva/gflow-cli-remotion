import { describe, it, expect, afterAll } from "vitest";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const cleanup: string[] = [];

afterAll(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

describe("render smoke", () => {
  it(
    "renders 30 frames of PromoSocial to a non-empty mp4",
    async () => {
      const outDir = mkdtempSync(join(tmpdir(), "render-smoke-"));
      cleanup.push(outDir);

      const serveUrl = await bundle({
        entryPoint: join(REPO_ROOT, "src", "remotion", "index.ts"),
      });

      const inputProps = {
        runDir: "",
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
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: output,
        inputProps,
        frameRange: [0, 30],
        chromiumOptions: { gl: "swiftshader" },
      });

      expect(statSync(output).size).toBeGreaterThan(0);
    },
    180_000,
  );
});
