/**
 * PII / secret scrubbing for the promo-pipeline event stream.
 *
 * Order matters: more-specific patterns precede more-generic ones (e.g. the
 * sapisidhash cookie rule runs before any catch-all that might eat its value).
 */

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.\w+/g, "<email>"],
  [/sapisidhash=[\w-]+/g, "sapisidhash=<redacted>"],
  [/1\/\/[\w-]+/g, "<refresh-token>"],
  [/ya29\.[\w.-]+/g, "<access-token>"],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<jwt>"],
  [/gAAAAAB[\w-]+/g, "<fernet-token>"],
  [/[A-Z]:\\Users\\[^\\]+\\/g, "<user-home>\\"],
  [/\/(Users|home)\/[^/]+\//g, "/<user-home>/"],
];

export function redact(s: string): string {
  let out = s;
  for (const [re, repl] of RULES) out = out.replace(re, repl);
  return out;
}

export function redactDeep<T>(v: T): T {
  if (typeof v === "string") return redact(v) as unknown as T;
  if (Array.isArray(v)) return v.map(redactDeep) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object)) out[k] = redactDeep(val);
    return out as T;
  }
  return v;
}
