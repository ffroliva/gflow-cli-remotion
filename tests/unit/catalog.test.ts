import { describe, it, expect } from "vitest";
import {
  catalog,
  byChannel,
  missingVertical,
  compositions,
  readyToRender,
} from "../../types/catalog";
import { hooks } from "../../types/hooks";

describe("catalog", () => {
  it("has unique ids", () => {
    const ids = catalog.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are kebab-case", () => {
    for (const a of catalog) {
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("every asset has real dimensions", () => {
    for (const a of catalog) {
      expect(a.width, `${a.id} width`).toBeGreaterThan(0);
      expect(a.height, `${a.id} height`).toBeGreaterThan(0);
      expect(a.bytes, `${a.id} bytes`).toBeGreaterThan(0);
    }
  });

  it("stills have no duration, motion assets do", () => {
    // Catches the copy-paste failure where a still inherits a duration, or a
    // clip is catalogued with none — either makes the entry unusable for
    // picking an asset to fit a platform's length limit.
    for (const a of catalog) {
      if (a.kind === "image") {
        expect(a.durationSec, `${a.id} is a still`).toBeNull();
      } else {
        expect(a.durationSec, `${a.id} is motion`).toBeGreaterThan(0);
      }
    }
  });

  it("every asset is published somewhere", () => {
    // An asset with no channel is either dead weight or an untracked
    // publication — both are worth failing on.
    for (const a of catalog) {
      expect(a.channels.length, `${a.id} has no channel`).toBeGreaterThan(0);
    }
  });

  it("addedIso is a valid ISO date", () => {
    for (const a of catalog) {
      expect(a.addedIso, `${a.id} addedIso`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(a.addedIso))).toBe(false);
    }
  });

  it("hookId, when set, names a real hook", () => {
    // Stops the catalog drifting from types/hooks.ts — a dangling hookId would
    // make an asset look re-renderable against a variant that no longer exists.
    const hookIds = new Set(hooks.map((h) => h.id));
    for (const a of catalog) {
      if (a.hookId !== null) {
        expect(hookIds.has(a.hookId), `${a.id} → unknown hook ${a.hookId}`).toBe(
          true,
        );
      }
    }
  });

  it("an asset from a composition records the run that made it", () => {
    // Provenance is only useful if it is complete: a composition without a run
    // id cannot actually be re-rendered, so half-filled provenance is worse
    // than none — it claims reusability the entry cannot deliver.
    for (const a of catalog) {
      if (a.sourceComposition !== null) {
        expect(
          a.sourceRunId,
          `${a.id} names a composition but no run id`,
        ).not.toBeNull();
      }
    }
  });

  it("byChannel returns only assets serving that channel", () => {
    expect(byChannel("readme").every((a) => a.channels.includes("readme"))).toBe(
      true,
    );
    expect(byChannel("demos").length).toBeGreaterThan(0);
  });

  it("shipped status agrees with the catalog", () => {
    // The two halves must not drift: a composition claiming `shipped: true`
    // with no catalogued asset naming it — or the reverse — means one of them
    // was updated and the other forgotten, which is exactly how the operator's
    // mental model got out of sync in the first place.
    for (const c of compositions) {
      const produced = catalog.some((a) => a.sourceComposition === c.id);
      expect(c.shipped, `${c.id}.shipped disagrees with the catalog`).toBe(
        produced,
      );
    }
  });

  it("an unshipped composition says what blocks it", () => {
    // "Not shipped, reason unknown" is the state this file exists to abolish.
    for (const c of compositions) {
      if (!c.shipped) {
        expect(c.blockedOn, `${c.id} is unshipped with no blocker`).toBeTruthy();
      }
    }
  });

  it("readyToRender returns only unblocked compositions", () => {
    expect(readyToRender().every((c) => c.blockedOn === null)).toBe(true);
  });

  it("reports the vertical-format gap", () => {
    // Documents today's real state rather than asserting an aspiration: every
    // catalogued asset is landscape, while PromoSocial (1080×1920) exists and
    // has never shipped output. Flip this expectation when that changes.
    expect(missingVertical()).toBe(true);
  });
});
