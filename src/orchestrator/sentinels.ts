/**
 * Cross-language stdout sentinels emitted by Python capture scripts and
 * matched by the TypeScript harnesses.
 *
 * The Python side (`scripts/capture/flow_*.py`) writes these exact tokens to
 * stdout with `flush=True`; the harnesses (`scripts/record-*.mts`) scan the
 * piped stdout buffer for them to drive OBS lifecycle + manifest building.
 *
 * IMPORTANT — keep these strings in sync with the Python emitters. The
 * Python sources reference this file in a comment near each `print(...)`
 * site; a mismatch silently breaks the READY gate (which times out) or the
 * phase-timing parser (which writes an empty manifest).
 */

/** Emitted by the Python child after the browser window is on Flow and ready
 *  for OBS to bind. Recording starts after this. */
export const READY_SENTINEL = "[workflow] READY";

/** Emitted at the start of each generation phase: `[workflow] PHASE START <kind>`
 *  where <kind> ∈ {t2i, i2i, video}. */
export const PHASE_START_PREFIX = "[workflow] PHASE START ";

/** Emitted at the end of each generation phase with the produced artifact path:
 *  `[workflow] PHASE END <kind> <artifact-path>`. */
export const PHASE_END_PREFIX = "[workflow] PHASE END ";

/** Emitted once after the final phase, just before context teardown. The
 *  harness stops recording after this. */
export const DONE_SENTINEL = "[workflow] DONE";

/** The kinds a workflow phase can take, in canonical execution order. */
export const PHASE_KINDS = ["t2i", "i2i", "video"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

/** Type guard — narrows an arbitrary string to a PhaseKind. Replaces the
 *  ad-hoc `kind as PhaseKind` cast at the sentinel parser callsite, so a
 *  drift on the python side (e.g. "upscale") is rejected at the type level. */
export function isPhaseKind(s: string): s is PhaseKind {
  return (PHASE_KINDS as readonly string[]).includes(s);
}
