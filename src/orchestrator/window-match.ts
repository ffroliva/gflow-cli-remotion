/**
 * Resolve an OBS-capturable window at record time.
 *
 * OBS enumerates windows as "title:class:executable" strings. The title of a
 * browser window drifts (the active tab/page changes the title), so a frozen
 * window string baked into the scene goes stale and OBS renders BLACK on an
 * exact-title miss. The orchestrator therefore re-resolves the live window
 * immediately before recording, matching by executable + a stable title
 * substring (e.g. "Flow") rather than a frozen full title.
 */

export interface ParsedWindow {
  title: string;
  cls: string;
  exe: string;
}

/** Split "title:class:exe". The exe + class are the last two fields; any
 *  remaining colons belong to the window title. */
export function parseWindowValue(value: string): ParsedWindow {
  const parts = value.split(":");
  const exe = parts.pop() ?? "";
  const cls = parts.pop() ?? "";
  const title = parts.join(":");
  return { title, cls, exe };
}

export interface PickWindowOptions {
  /** Executable name to match, e.g. "chrome.exe" (case-insensitive). */
  exe: string;
  /** Stable whole-word the window title must contain, e.g. "Flow"
   *  (case-insensitive, word-boundary). Omit to accept any window of the given
   *  exe. Word-boundary matters: a naive substring match for "Flow" also hits
   *  "gflow-cli" (the CLI's own GitHub/IDE tabs) and binds the wrong window. */
  titleIncludes?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pick the OBS window string ("title:class:exe") to capture.
 *
 * Returns the first window whose executable matches and — when `titleIncludes`
 * is given — whose title contains that substring. Returns null when nothing
 * matches; the caller should fail fast rather than capture the wrong window
 * (a wrong-window capture is how the polluted masters happened).
 */
export function pickWindow(
  values: string[],
  opts: PickWindowOptions,
): string | null {
  const exe = opts.exe.toLowerCase();
  const sameExe = values.filter(
    (v) => parseWindowValue(v).exe.toLowerCase() === exe,
  );
  if (sameExe.length === 0) return null;

  if (opts.titleIncludes) {
    const re = new RegExp(`\\b${escapeRegExp(opts.titleIncludes)}\\b`, "i");
    const titled = sameExe.find((v) => re.test(parseWindowValue(v).title));
    return titled ?? null;
  }
  return sameExe[0] ?? null;
}
