import { describe, it, expect } from "vitest";
import {
  FakeObsAdapter,
  RealObsAdapter,
  type ObsAdapter,
} from "../../src/orchestrator/obs";

describe("FakeObsAdapter", () => {
  it("records start/stop calls in order", async () => {
    const fake = new FakeObsAdapter();
    await fake.connect();
    await fake.startRecording("/tmp/master.mp4");
    await fake.stopRecording();
    await fake.disconnect();
    expect(fake.calls).toEqual([
      ["connect"],
      ["startRecording", "/tmp/master.mp4"],
      ["stopRecording"],
      ["disconnect"],
    ]);
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
