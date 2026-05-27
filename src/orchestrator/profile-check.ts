/**
 * Verify the gflow Chrome-strategy profile marker before any paid recording.
 *
 * gflow writes a `.gflow_browser_strategy` file containing the literal string
 * "chrome" into every Chrome-strategy profile directory. The promo orchestrator
 * refuses to drive any profile whose marker is missing or says something else
 * (chromium / edge / firefox) — per the operator memo on real-browser-auth
 * being mandatory for paid runs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function verifyChromeProfile(profileDir: string): void {
  const path = join(profileDir, ".gflow_browser_strategy");
  let content: string;
  try {
    content = readFileSync(path, "utf-8").trim();
  } catch {
    throw new Error(
      `marker file missing at ${path} — promo recordings require a Chrome-strategy profile`,
    );
  }
  if (content !== "chrome") {
    throw new Error(
      `marker file at ${path} contains '${content}', expected 'chrome'`,
    );
  }
}
