import { describe, it, expect } from "vitest";
import { scrubEnv } from "../../src/orchestrator/env-scrub";

describe("scrubEnv()", () => {
  it("keeps PATH and USERPROFILE", () => {
    const out = scrubEnv({ PATH: "/usr/bin", USERPROFILE: "C:\\Users\\f" });
    expect(out.PATH).toBe("/usr/bin");
    expect(out.USERPROFILE).toBe("C:\\Users\\f");
  });
  it("strips OBS_WS_PASSWORD", () => {
    const out = scrubEnv({ PATH: "/usr/bin", OBS_WS_PASSWORD: "secret" });
    expect(out.OBS_WS_PASSWORD).toBeUndefined();
  });
  it("strips arbitrary *_TOKEN and *_SECRET", () => {
    const out = scrubEnv({ PATH: "/usr/bin", GH_TOKEN: "x", FOO_SECRET: "y" });
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.FOO_SECRET).toBeUndefined();
  });
  it("strips *_API_KEY and *_PASSWORD", () => {
    const out = scrubEnv({
      PATH: "/",
      OPENAI_API_KEY: "sk-xxx",
      DB_PASSWORD: "hunter2",
    });
    expect(out.OPENAI_API_KEY).toBeUndefined();
    expect(out.DB_PASSWORD).toBeUndefined();
  });
  it("keeps GFLOW_CLI_PROFILE", () => {
    const out = scrubEnv({ PATH: "/", GFLOW_CLI_PROFILE: "promo-x" });
    expect(out.GFLOW_CLI_PROFILE).toBe("promo-x");
  });
  it("drops anything outside the allow-list (default-deny)", () => {
    const out = scrubEnv({ PATH: "/", RANDOM_VAR: "leaked" });
    expect(out.RANDOM_VAR).toBeUndefined();
  });
  it("skips undefined values without crashing", () => {
    const out = scrubEnv({ PATH: "/", UNSET: undefined });
    expect(out.PATH).toBe("/");
    expect(out.UNSET).toBeUndefined();
  });
});
