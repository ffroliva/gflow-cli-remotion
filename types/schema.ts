import { z } from "zod";

// ── RunManifest ──────────────────────────────────────────────────────────────

export const PhaseKind = z.enum(["t2i", "batch", "video", "data"]);
export type PhaseKind = z.infer<typeof PhaseKind>;

export const StructLogEvent = z.object({
  ts: z.string(),
  event: z.string(),
  level: z.string(),
  data: z.record(z.string(), z.unknown()),
}).strict();

export const Phase = z.object({
  kind: PhaseKind,
  cmd: z.string(),
  startedMs: z.number().int(),
  endedMs: z.number().int(),
  exitCode: z.number().int(),
  artifacts: z.array(z.string()),
  events: z.array(StructLogEvent).default([]),
}).strict();

export const Recording = z.object({
  source: z.literal("obs"),
  masterPath: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  fps: z.number().int(),
  durationMs: z.number().int(),
}).strict();

export const Env = z.object({
  gflowVersion: z.string(),
  nodeVersion: z.string(),
  obsVersion: z.string(),
  os: z.string(),
  browserStrategy: z.literal("chrome"),
}).strict();

export const RunManifest = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  startedAtIso: z.string(),
  startedAtMonotonic: z.number(),
  profile: z.string(),
  env: Env,
  phases: z.array(Phase).min(1),
  recording: Recording,
}).strict();

export type RunManifest = z.infer<typeof RunManifest>;
