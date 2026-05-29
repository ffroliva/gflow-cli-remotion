/**
 * Tests for the shared `recordSession` helper. Phase-3 council (Tests
 * dimension) Must-Add #1: error propagation through OBS lifecycle.
 *
 * What this catches: if a future change drops the inner try/catch around
 * `stopRecording`, a Flow error inside `run()` would be masked by a noisy
 * OBS-cleanup error from `waitForStableSize` timing out on a never-recorded
 * file. Phase-3 council #2 / #4 / #5 of the Correctness dimension all
 * hinged on getting this right.
 */

import { describe, it, expect } from "vitest";

import { FakeObsAdapter } from "../../src/orchestrator/obs";
import { recordSession } from "../../src/orchestrator/obs-session";

describe("recordSession", () => {
  it("propagates a run() error but still calls stopRecording and disconnect", async () => {
    const fake = new FakeObsAdapter();
    const boom = new Error("boom: flow refused");
    await expect(
      recordSession({ adapter: fake, masterPath: "/tmp/m.mp4", dryRun: true }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    // The lifecycle must still run cleanly: prepareBrowserScene + start +
    // stop + disconnect, in that order, even though run() threw.
    expect(fake.calls.map((c) => c[0])).toEqual([
      "connect",
      "prepareBrowserScene",
      "startRecording",
      "stopRecording",
      "disconnect",
    ]);
  });

  it("returns the actual master path from stopRecording on the happy path", async () => {
    const fake = new FakeObsAdapter();
    const res = await recordSession(
      { adapter: fake, masterPath: "/tmp/m.mp4", dryRun: true },
      async () => {
        /* no-op; recording window */
      },
    );
    expect(res.actualMasterPath).toBe("fake://master.mp4");
    expect(fake.calls.map((c) => c[0])).toEqual([
      "connect",
      "prepareBrowserScene",
      "startRecording",
      "stopRecording",
      "disconnect",
    ]);
  });

  it("awaits windowReady before prepareBrowserScene", async () => {
    const fake = new FakeObsAdapter();
    let resolveWindow!: () => void;
    const windowReady = new Promise<void>((r) => {
      resolveWindow = r;
    });
    const order: string[] = [];
    const original = fake.prepareBrowserScene.bind(fake);
    fake.prepareBrowserScene = async (opts) => {
      order.push("prepareBrowserScene");
      await original(opts);
    };

    const sessionP = recordSession(
      { adapter: fake, masterPath: "/tmp/m.mp4", dryRun: true, windowReady },
      async () => {
        /* no-op */
      },
    );
    // Give connect a tick to run, then verify prepare did NOT run yet.
    await new Promise((r) => setImmediate(r));
    expect(order).not.toContain("prepareBrowserScene");
    resolveWindow();
    await sessionP;
    expect(order).toEqual(["prepareBrowserScene"]);
  });
});
