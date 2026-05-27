/**
 * Parse and filter structlog JSON-lines emitted by gflow on stdout.
 *
 * Path b from the design spec: the orchestrator consumes gflow's existing
 * dotted event names without requiring any new events on the gflow side.
 * Lines that don't match the allow-list, that fail JSON.parse, or that lack
 * required envelope fields are silently dropped (§9.6 exception-safety —
 * we must never crash the orchestrator pipe).
 *
 * All string leaves in `data` are passed through redactDeep() before the
 * envelope is committed to run.json.
 */

import { redactDeep } from "./redact";

const ALLOW_RE =
  /^(ui_automation|ui_automation_video|image_batch|reference_attached|error_raised)/;

export interface EventEnvelope {
  ts: string;
  event: string;
  level: string;
  data: Record<string, unknown>;
}

export function parseEventStream(lines: string[]): EventEnvelope[] {
  const out: EventEnvelope[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const rec = obj as Record<string, unknown>;
    if (typeof rec.event !== "string") continue;
    if (!ALLOW_RE.test(rec.event)) continue;
    const data =
      rec.data && typeof rec.data === "object"
        ? (rec.data as Record<string, unknown>)
        : {};
    out.push({
      ts: typeof rec.ts === "string" ? rec.ts : "",
      event: rec.event,
      level: typeof rec.level === "string" ? rec.level : "info",
      data: redactDeep(data),
    });
  }
  return out;
}
