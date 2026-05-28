/**
 * Single source of truth for where a promo run lives on disk.
 *
 * record-promo.mts WRITES master.mp4 + run.json here; render-matrix.mts READS
 * from here. Keeping the resolution in one place means the writer and reader
 * can never drift — a divergence would silently mean "rendered nothing".
 */

import { join } from "node:path";

export function resolveOutRoot(runId: string): string {
  const home =
    process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;
  if (!home) {
    throw new Error(
      process.platform === "win32"
        ? "USERPROFILE env var missing on Windows host"
        : "HOME env var missing",
    );
  }
  return join(home, "gflow-output", "promo", runId);
}
