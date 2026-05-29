import { mkdtempSync, rmSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  FakeObsAdapter,
  RealObsAdapter,
  waitForStableSize,
  type ObsAdapter,
} from "../../src/orchestrator/obs";

describe("FakeObsAdapter", () => {
  it("records start/stop calls in order and stopRecording returns a path", async () => {
    const fake = new FakeObsAdapter();
    await fake.connect();
    await fake.startRecording();
    const actualPath = await fake.stopRecording();
    await fake.disconnect();
    expect(fake.calls).toEqual([
      ["connect"],
      ["startRecording"],
      ["stopRecording"],
      ["disconnect"],
    ]);
    expect(actualPath).toBe("fake://master.mp4");
  });

  it("conforms to ObsAdapter interface", () => {
    const fake: ObsAdapter = new FakeObsAdapter();
    expect(typeof fake.connect).toBe("function");
    expect(typeof fake.startRecording).toBe("function");
    expect(typeof fake.stopRecording).toBe("function");
    expect(typeof fake.disconnect).toBe("function");
  });

  it("starts with an empty call log per instance", () => {
    const a = new FakeObsAdapter();
    const b = new FakeObsAdapter();
    expect(a.calls).toEqual([]);
    expect(b.calls).toEqual([]);
  });
});

describe("RealObsAdapter", () => {
  it("refuses to construct without OBS_WS_PASSWORD", () => {
    const prev = process.env.OBS_WS_PASSWORD;
    delete process.env.OBS_WS_PASSWORD;
    try {
      expect(() => new RealObsAdapter()).toThrow(/OBS_WS_PASSWORD/);
    } finally {
      if (prev !== undefined) process.env.OBS_WS_PASSWORD = prev;
    }
  });

  it("constructs when OBS_WS_PASSWORD is set", () => {
    const prev = process.env.OBS_WS_PASSWORD;
    process.env.OBS_WS_PASSWORD = "test-secret";
    try {
      expect(() => new RealObsAdapter()).not.toThrow();
    } finally {
      if (prev === undefined) delete process.env.OBS_WS_PASSWORD;
      else process.env.OBS_WS_PASSWORD = prev;
    }
  });
});

describe("waitForStableSize", () => {
  // Closes the regression surface for the 0-byte-master race fixed this
  // session: obs-websocket v5 StopRecord returns BEFORE the muxer flushes
  // the moov atom, so a naive copy lands on a truncated/empty file. This
  // helper polls until size is stable across two samples.

  it("resolves once the file size is stable across two samples", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stable-size-"));
    const file = join(dir, "growing.mp4");
    try {
      writeFileSync(file, new Uint8Array(100));
      // Tail-write more bytes once after the first poll, then stop growing —
      // the size should stabilize and the helper should resolve.
      const writer = setTimeout(() => appendFileSync(file, new Uint8Array(200)), 100);
      await waitForStableSize(file, { timeoutMs: 5_000, intervalMs: 50 });
      clearTimeout(writer);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("polls cleanly through ENOENT until the file appears", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stable-size-enoent-"));
    const file = join(dir, "appears-late.mp4");
    try {
      // Create the file after a delay; the helper must not throw on the
      // initial statSync ENOENT (real-world OBS may delay file creation).
      const creator = setTimeout(() => writeFileSync(file, new Uint8Array(500)), 150);
      await waitForStableSize(file, { timeoutMs: 5_000, intervalMs: 50 });
      clearTimeout(creator);
    } finally {
      try {
        unlinkSync(file);
      } catch {
        // file may not have been created yet on path that didn't go through
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects with a clear timeout message when the file never stabilizes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stable-size-timeout-"));
    const file = join(dir, "never-exists.mp4");
    try {
      await expect(
        waitForStableSize(file, { timeoutMs: 300, intervalMs: 50 }),
      ).rejects.toThrow(/did not finalize within 300ms/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
