import { describe, it, expect } from "vitest";
import { hooks } from "../../types/hooks";

describe("hooks", () => {
  it("has 3–12 entries", () => {
    expect(hooks.length).toBeGreaterThanOrEqual(3);
    expect(hooks.length).toBeLessThanOrEqual(12);
  });

  it("has unique ids", () => {
    const ids = hooks.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are kebab-case", () => {
    for (const h of hooks) {
      expect(h.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("title ≤32 chars and subtitle ≤80 chars", () => {
    for (const h of hooks) {
      expect(h.title.length, `title too long: ${h.title}`).toBeLessThanOrEqual(
        32,
      );
      expect(
        h.subtitle.length,
        `subtitle too long: ${h.subtitle}`,
      ).toBeLessThanOrEqual(80);
    }
  });

  it("every hook has a positive durationMs", () => {
    for (const h of hooks) {
      expect(h.durationMs).toBeGreaterThan(0);
    }
  });
});
