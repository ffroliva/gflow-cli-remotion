import { describe, it, expect } from "vitest";
import { parseWindowValue, pickWindow } from "../../src/orchestrator/window-match";

// OBS encodes a capturable window as "title:class:executable".
describe("parseWindowValue()", () => {
  it("splits a simple title:class:exe", () => {
    expect(parseWindowValue("Search bar:Chrome_WidgetWin_1:msedge.exe")).toEqual({
      title: "Search bar",
      cls: "Chrome_WidgetWin_1",
      exe: "msedge.exe",
    });
  });
  it("keeps colons that belong to the title (exe/class are the last two fields)", () => {
    expect(
      parseWindowValue("Flow: my project:Chrome_WidgetWin_1:chrome.exe"),
    ).toEqual({
      title: "Flow: my project",
      cls: "Chrome_WidgetWin_1",
      exe: "chrome.exe",
    });
  });
});

describe("pickWindow()", () => {
  const FLOW = "Flow - May 28 - Google Chrome:Chrome_WidgetWin_1:chrome.exe";
  // Decoy: the CLI's own GitHub tab — title contains the substring "flow"
  // (inside "gflow-cli") but NOT the whole word "Flow".
  const GFLOW_DECOY =
    "Issues · ffroliva/gflow-cli - Google Chrome:Chrome_WidgetWin_1:chrome.exe";
  const live = [
    "gflow-showcase-terminal:ConsoleWindowClass:powershell.exe",
    GFLOW_DECOY,
    FLOW,
    "Google AI Studio - Google Chrome:Chrome_WidgetWin_1:chrome.exe",
    "Search bar:Chrome_WidgetWin_1:msedge.exe",
  ];

  it("finds the Flow chrome window among several windows", () => {
    expect(pickWindow(live, { exe: "chrome.exe", titleIncludes: "Flow" })).toBe(FLOW);
  });

  it("does NOT match 'gflow-cli' for title 'Flow' (word boundary, not substring)", () => {
    const picked = pickWindow(live, { exe: "chrome.exe", titleIncludes: "Flow" });
    expect(picked).not.toBe(GFLOW_DECOY);
    expect(picked).toBe(FLOW);
  });

  it("matches exe case-insensitively", () => {
    expect(pickWindow(live, { exe: "CHROME.EXE", titleIncludes: "Flow" })).toBe(FLOW);
  });

  it("returns null when no window runs the requested exe", () => {
    expect(pickWindow(live, { exe: "firefox.exe", titleIncludes: "Flow" })).toBeNull();
  });

  it("returns null when the exe matches but no title matches (avoid grabbing the wrong window)", () => {
    expect(
      pickWindow(live, { exe: "chrome.exe", titleIncludes: "Veo Studio" }),
    ).toBeNull();
  });

  it("returns the first same-exe window when no titleIncludes is given", () => {
    expect(pickWindow(live, { exe: "chrome.exe" })).toBe(GFLOW_DECOY);
  });
});
