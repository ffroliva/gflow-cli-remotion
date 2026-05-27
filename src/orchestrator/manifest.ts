/**
 * Write a Zod-validated run.json into a recording's outDir.
 *
 * Two safety properties beyond a naive writeFileSync:
 *   1. Re-validates the manifest with Zod before writing — defence against
 *      callers that mutated the object after parsing.
 *   2. Refuses to overwrite an existing run.json unless force=true — operators
 *      will not lose an earlier recording's evidence to a re-run with the same
 *      runId.
 */

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RunManifest, type RunManifest as RunManifestT } from "../../types/schema";

export interface WriteManifestOpts {
  force?: boolean;
}

export function writeManifest(
  runDir: string,
  manifest: RunManifestT,
  opts: WriteManifestOpts = {},
): void {
  const path = join(runDir, "run.json");
  if (existsSync(path) && !opts.force) {
    throw new Error(
      `run.json already exists at ${path}; pass --force to overwrite`,
    );
  }
  const validated = RunManifest.parse(manifest);
  writeFileSync(path, JSON.stringify(validated, null, 2) + "\n", "utf-8");
}
