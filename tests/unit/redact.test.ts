import { describe, it, expect } from "vitest";
import { redact, redactDeep } from "../../src/orchestrator/redact";

describe("redact()", () => {
  it("strips email", () => {
    expect(redact("contact me at foo@bar.com")).toBe("contact me at <email>");
  });
  it("strips Google OAuth refresh token", () => {
    expect(redact("token=1//abc123")).toBe("token=<refresh-token>");
  });
  it("strips Google OAuth access token", () => {
    expect(redact("token=ya29.aBcD-1234")).toBe("token=<access-token>");
  });
  it("strips JWT", () => {
    expect(redact("Authorization: Bearer eyJa.eyJb.cccc")).toBe(
      "Authorization: Bearer <jwt>",
    );
  });
  it("strips Fernet token", () => {
    expect(redact("cred=gAAAAABabc123_def")).toBe("cred=<fernet-token>");
  });
  it("strips sapisidhash", () => {
    expect(redact("Cookie: sapisidhash=abc123_def-xyz; foo=bar")).toBe(
      "Cookie: sapisidhash=<redacted>; foo=bar",
    );
  });
  it("strips Windows user path", () => {
    expect(redact("at C:\\Users\\flavio\\AppData\\Local")).toBe(
      "at <user-home>\\AppData\\Local",
    );
  });
  it("strips POSIX user path", () => {
    expect(redact("at /Users/flavio/Library/")).toBe("at /<user-home>/Library/");
  });
  it("leaves harmless content alone", () => {
    expect(redact("phase=t2i exit=0 ms=1234")).toBe("phase=t2i exit=0 ms=1234");
  });
});

describe("redactDeep()", () => {
  it("recurses into nested objects + arrays, scrubbing string leaves", () => {
    const input = {
      user: "foo@bar.com",
      meta: { path: "C:\\Users\\flavio\\.config", count: 7 },
      tokens: ["1//abc", "ya29.def"],
      raw: { keep: true, n: 42 },
    };
    const out = redactDeep(input);
    expect(out).toEqual({
      user: "<email>",
      meta: { path: "<user-home>\\.config", count: 7 },
      tokens: ["<refresh-token>", "<access-token>"],
      raw: { keep: true, n: 42 },
    });
  });
  it("passes through primitives and nullish unchanged", () => {
    expect(redactDeep(0)).toBe(0);
    expect(redactDeep(false)).toBe(false);
    expect(redactDeep(null)).toBe(null);
    expect(redactDeep(undefined)).toBe(undefined);
  });
});
