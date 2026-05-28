/**
 * Allow-list-based env-var scrubber for the gflow child process.
 *
 * Default-deny: only keys in ALLOW_LIST survive, and even then keys
 * matching FORBIDDEN patterns (TOKEN/SECRET/PASSWORD/API_KEY/OBS_WS)
 * are dropped — defence in depth against an operator accidentally
 * adding a secret to the allow-list.
 */

const ALLOW_LIST = new Set([
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "SystemRoot",
  "TEMP",
  "TMP",
  "GFLOW_CLI_PROFILE",
  "GFLOW_CLI_OUT_DIR",
  "GFLOW_CLI_LOG_LEVEL",
]);

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /^OBS_WS/,
  /TOKEN$/,
  /SECRET$/,
  /PASSWORD$/,
  /API_KEY$/,
  /^GH_TOKEN/,
];

export function scrubEnv(
  src: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue;
    if (FORBIDDEN.some((re) => re.test(k))) continue;
    if (ALLOW_LIST.has(k)) out[k] = v;
  }
  return out;
}
