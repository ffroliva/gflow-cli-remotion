import { describe, it, expect } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RunManifest } from "../../types/schema";

describe("schema-snapshot contract", () => {
  it("z.toJSONSchema matches committed fixture", () => {
    const generated = z.toJSONSchema(RunManifest);
    const committed = JSON.parse(
      readFileSync(join(__dirname, "../fixtures/run-manifest.schema.json"), "utf-8")
    );
    expect(generated).toEqual(committed);
  });
});
