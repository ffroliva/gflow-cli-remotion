import { describe, it, expect } from "vitest";
import { PROMO_PROMPTS } from "../../types/promo-prompts";

const BANNED: ReadonlyArray<RegExp> = [
  /@[\w.-]+/, // email handles / mentions
  /\bsecret\b/i,
  /\binternal\b/i,
  /<[^>]+>/, // angle-bracket placeholders
];

describe("promo-prompts lint", () => {
  it("is non-empty", () => {
    expect(PROMO_PROMPTS.length).toBeGreaterThan(0);
  });

  it("contains no banned phrases", () => {
    for (const p of PROMO_PROMPTS) {
      for (const re of BANNED) {
        expect(p, `banned phrase ${re} in: ${p}`).not.toMatch(re);
      }
    }
  });

  it("each prompt ≤200 chars", () => {
    for (const p of PROMO_PROMPTS) {
      expect(p.length).toBeLessThanOrEqual(200);
    }
  });

  it("has no duplicate prompts", () => {
    expect(new Set(PROMO_PROMPTS).size).toBe(PROMO_PROMPTS.length);
  });
});
