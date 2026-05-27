import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEventStream } from "../../src/orchestrator/event-stream";

const FIXTURE_PATH = join(
  __dirname,
  "../fixtures/gflow-stdout/t2i.jsonl",
);
const FIXTURE_LINES = readFileSync(FIXTURE_PATH, "utf-8")
  .trim()
  .split("\n");

describe("parseEventStream()", () => {
  it("parses JSON lines and drops malformed ones", () => {
    const result = parseEventStream([...FIXTURE_LINES, "not-json", ""]);
    // 5 ui_automation.* + 1 error_raised; random_internal_debug dropped by allow-list.
    expect(result).toHaveLength(6);
  });

  it("filters to allow-list event names", () => {
    const result = parseEventStream(FIXTURE_LINES);
    for (const e of result) {
      expect(e.event).toMatch(
        /^(ui_automation|ui_automation_video|image_batch|reference_attached|error_raised)/,
      );
    }
    expect(
      result.find((e) => e.event === "random_internal_debug"),
    ).toBeUndefined();
  });

  it("redacts emails in event data", () => {
    const result = parseEventStream([
      JSON.stringify({
        ts: "2026-05-27T00:00:00Z",
        event: "error_raised",
        level: "error",
        data: { msg: "user foo@bar.com failed" },
      }),
    ]);
    expect(result[0]!.data.msg).toBe("user <email> failed");
  });

  it("redacts Windows user paths in nested event data", () => {
    const result = parseEventStream(FIXTURE_LINES);
    const downloaded = result.find(
      (e) => e.event === "ui_automation.image_downloaded",
    );
    expect(downloaded?.data.path).toBe(
      "<user-home>\\gflow-output\\image-001.png",
    );
  });

  it("survives lines missing required envelope fields", () => {
    const result = parseEventStream([
      JSON.stringify({ ts: "x", level: "info", data: {} }), // no `event`
      JSON.stringify({ event: 123, ts: "x", level: "info", data: {} }), // wrong type
    ]);
    expect(result).toHaveLength(0);
  });

  it("defaults missing data field to empty object", () => {
    const result = parseEventStream([
      JSON.stringify({
        ts: "2026-05-27T00:00:00Z",
        event: "ui_automation.test",
        level: "info",
      }),
    ]);
    expect(result[0]!.data).toEqual({});
  });

  it("returns an empty array for an empty input", () => {
    expect(parseEventStream([])).toEqual([]);
  });
});
