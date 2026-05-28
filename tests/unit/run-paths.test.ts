import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { resolveOutRoot } from "../../src/orchestrator/run-paths";

describe("resolveOutRoot()", () => {
  const prevUser = process.env.USERPROFILE;
  const prevHome = process.env.HOME;

  beforeEach(() => {
    process.env.USERPROFILE = "C:\\Users\\test";
    process.env.HOME = "/home/test";
  });
  afterEach(() => {
    if (prevUser === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUser;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  });

  it("nests under gflow-output/promo/<runId>", () => {
    const out = resolveOutRoot("2026-05-28-001");
    expect(out).toContain(join("gflow-output", "promo", "2026-05-28-001"));
  });

  it("uses the platform home base", () => {
    const base = process.platform === "win32" ? "C:\\Users\\test" : "/home/test";
    expect(resolveOutRoot("x")).toBe(join(base, "gflow-output", "promo", "x"));
  });

  it("throws when the platform home var is unset", () => {
    delete process.env.USERPROFILE;
    delete process.env.HOME;
    expect(() => resolveOutRoot("x")).toThrow();
  });
});
