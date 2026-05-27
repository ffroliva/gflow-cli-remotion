# Promo Pipeline — Design

**Status:** Draft — council-reviewed (2026-05-27), Tier 1 + key Tier 2 fixes applied, path (b) committed
**Date:** 2026-05-27
**Owner:** Flavio Oliva
**Repo:** `gflow-cli-remotion` (this one). Companion library: `gflow-cli` (Python, unchanged).
**Companion spec:** `gflow-cli/docs/superpowers/specs/2026-05-27-public-event-surface-design.md` — the public event surface that v2 of this orchestrator will consume once Phase 1+2 of that spec ships. v1 binds to existing Tier 3 dotted events; v2 migrates to Tier 1+2 with a schema bump.

---

## 1. Goals & Non-Goals

### Goals

1. Produce **social-media promo set** — vertical (9:16, ~30-60s) + landscape (16:9) — to post on X, LinkedIn, TikTok, YouTube Shorts.
2. Produce **README hero asset** — a ≤10 MB GIF (or short MP4), ~30 s, no audio, suitable for inline embed in `gflow-cli/README.md`.
3. Showcase the **full gflow tour** in one recording session: `gflow image t2i` (4 aspect ratios), `gflow run` (batch), `gflow video t2v`, `gflow data list`.
4. Support **A/B hook testing**: from one source recording, render N variants where only the opening 3 s hook (title + subtitle) differs. Operator picks the best-performing one based on social-platform metrics.
5. Keep `gflow-cli` **untouched**. The library is the library; promotion is not its business.

### Non-Goals (v1)

- No voiceover (silent + kinetic-typography captions only). Voiceover is a v2 variant produced from the same source.
- No AWS Lambda cloud rendering. Render locally. (Sibling repo has the plumbing — defer until local renders become painful.)
- No auto-publishing to social platforms — operator uploads keepers manually.
- No analytics ingestion — performance comparison stays out of band (spreadsheet, head).
- No multi-language hook variants.

---

## 2. Architecture

```
┌─ gflow-cli  (Python + PowerShell)  UNCHANGED ─────────────┐
│  emits structlog JSON events on stdout (existing v1):     │
│    ui_automation.entered_editor                           │
│    ui_automation_video.editor_ready                       │
│    image_batch.row_completed                              │
│    image_batch.submission_attempt                         │
│    reference_attached                                     │
│    error_raised                                           │
│  + process exit (code 0/non-0) + filesystem artifacts     │
└────────────────────────────────────────────────────────────┘
                       │  (subprocess stdout)
                       ▼
┌─ gflow-cli-remotion  (Node + Remotion)  OWNS PROMO ───────┐
│                                                            │
│  scripts/record-promo.mjs   orchestrator entrypoint        │
│   ├─ src/orchestrator/obs.ts             obs-websocket-js  │
│   ├─ src/orchestrator/event-stream.ts    parses gflow JSON │
│   ├─ src/orchestrator/phases.ts          t2i/batch/t2v/dat │
│   └─ src/orchestrator/manifest.ts        writes run.json   │
│                                                            │
│  types/schema.ts            Zod  ←  SINGLE SOURCE OF TRUTH │
│  types/hooks.ts             [{ id, title, subtitle, durMs}]│
│                                                            │
│  src/remotion/promo/                                       │
│    PromoMaster.tsx          1920×1080  60-90 s long-form   │
│    PromoSocial.tsx          1080×1920  30-60 s hook in 3 s │
│    ReadmeLoop.tsx           1280×720   30 s, GIF source    │
│  src/remotion/Root.tsx      register the three             │
│                                                            │
│  src/pages/index.tsx        @remotion/player live preview  │
│                                                            │
│  scripts/render-matrix.mjs  N hooks × 3 formats fan-out    │
│  scripts/post-gif.mjs       ffmpeg + gifski → README GIF   │
└────────────────────────────────────────────────────────────┘

Filesystem (machine-local, NOT committed):
  ~/gflow-output/promo/<run-id>/
    ├── master.mp4              ← OBS records here
    └── run.json                ← orchestrator writes here

Filesystem (in repo, NOT committed by default):
  gflow-cli-remotion/out/promo/<run-id>/
    ├── <hook-id>-master.mp4
    ├── <hook-id>-social.mp4
    └── <hook-id>-readme.gif

Distribution:
  gflow-cli-remotion GitHub Releases       ← keepers uploaded here
  gflow-cli/README.md                       ← links via cross-repo URL
```

**One-way data flow.** No coupling: gflow-cli does not know the promo pipeline exists. The Remotion repo consumes gflow's stdout the same way any other observer would.

---

## 3. Components & Responsibilities

| File | LOC (est.) | Responsibility |
|---|---|---|
| `scripts/record-promo.mjs` | ~250 | CLI entrypoint. Parses `--profile`, `--run-id`, `--phases`. Starts OBS, runs phases sequentially, stops OBS, writes manifest. |
| `src/orchestrator/obs.ts` | ~100 | Thin wrapper around `obs-websocket-js`. `connect()`, `startRecording(outputPath)`, `stopRecording()`. Times out after 5 s if OBS isn't responsive. |
| `src/orchestrator/event-stream.ts` | ~80 | Reads child-process stdout line-by-line, JSON-parses each, validates against a known event-shape allow-list, surfaces `phase_started` / `phase_completed` / `error_raised` to callers. |
| `src/orchestrator/phases.ts` | ~120 | Defines the 4 phases as a const array. Each entry: `{ kind, cmd, args, expectedArtifacts, maxDurationMs }`. Spawns `gflow` via `child_process.spawn`, pipes stdout through `event-stream.ts`. |
| `src/orchestrator/manifest.ts` | ~60 | Serializes the `RunManifest` Zod type to `run.json`. Single concern: filesystem write + schema validation. |
| `types/schema.ts` | ~80 | Zod schema for `RunManifest`. Exported as TypeScript type + as JSON Schema (via `zod-to-json-schema`). |
| `types/hooks.ts` | ~50 | A `const hooks: Hook[]` array. Each `Hook = { id: string, title: string, subtitle: string, durationMs: number }`. Tested for `id` uniqueness. |
| `src/remotion/promo/PromoMaster.tsx` | ~150 | 1920×1080. Long-form. Title card → phase montage with structlog event timestamps → end card. Reads `run.json` via `getInputProps()`. |
| `src/remotion/promo/PromoSocial.tsx` | ~180 | 1080×1920. Hook (3 s) → fast-paced montage (~30 s) → CTA. Hook text is a prop. |
| `src/remotion/promo/ReadmeLoop.tsx` | ~100 | 1280×720, 30 s, designed for seamless GIF loop. No hook prop (one canonical variant). |
| `src/remotion/Root.tsx` | ~30 | Registers the three compositions. Replaces `MyComp/`. |
| `scripts/render-matrix.mjs` | ~80 | For each `Hook` × `{master, social, readmeLoop}` → invoke `@remotion/renderer` or `npx remotion render`. Writes to `out/promo/<run-id>/`. |
| `scripts/post-gif.mjs` | ~50 | Post-process `<hook>-readme.mp4` → `<hook>-readme.gif` via ffmpeg + gifski. Logic ported from `gflow-cli/scripts/record_demo.ps1` (which is then deleted in the §11 follow-up; treat the PS1 as a reference, not a runtime dependency). |
| `src/orchestrator/obs.ts` exports an `ObsAdapter` interface | (counted above) | `RealObsAdapter` (default, uses obs-websocket-js) + `FakeObsAdapter` (selected when `--dry-run` is passed). DI seam for §8 mock integration. |

**Total Node code: ~1300 LOC.** Three Remotion compositions are the heaviest (~430 LOC); orchestrator is ~530 LOC; rest is glue.

**Existing template assets removed:** `src/remotion/MyComp/` (Rings, TextFade, NextLogo, Main) and the demo `src/pages/index.tsx` content. The `@remotion/player` page is reworked to preview the three new compositions.

---

## 4. Data Flow

### Recording session

```
operator: pnpm record-promo --profile denon82 --run-id 2026-05-27-001

  1. record-promo.mjs:
     - validates obs-websocket reachable (port 4455 default, password from env)
     - validates `gflow` is on PATH and the named Chrome-strategy profile exists
     - assembles outputPath = ~/gflow-output/promo/2026-05-27-001/master.mp4
  2. obs.ts: StartRecord → OBS begins capturing the composed scene
     (terminal left + headed Chrome window right, both visible)
  3. phases.ts × 4: sequentially spawns the gflow tour:
       (a) gflow image t2i "...promo prompt..." --aspect 16:9
       (b) gflow run --config examples/promo-batch.json   (covers 9:16, 1:1, 4:3)
       (c) gflow video t2v "...promo prompt..." --model veo3
       (d) gflow data list images --limit 6
     Each phase:
       - records startedMs (monotonic) before spawn
       - pipes stdout through event-stream.ts (filter rule: keep events
         whose name matches /^(ui_automation|ui_automation_video|
         image_batch|reference_attached|error_raised)$/, drop everything else)
       - process exit (code 0) → records endedMs = now() + scans expectedArtifacts
         dir via fs.readdir → fills artifacts[]
       - non-zero exit OR maxDurationMs timeout → kill child, stop OBS,
         write partial manifest, exit non-zero. Do NOT render.
  4. obs.ts: StopRecord → OBS finalizes master.mp4
  5. manifest.ts: writes run.json with Zod-validated shape
  6. operator: file listing shows
       ~/gflow-output/promo/2026-05-27-001/master.mp4   (60-120 MB MP4)
       ~/gflow-output/promo/2026-05-27-001/run.json     (~10 KB)
```

### Render session

```
operator: pnpm dev
  → Next.js Studio opens at http://localhost:3000
  → operator can scrub through PromoSocial.tsx with each Hook from types/hooks.ts
  → @remotion/player live-preview, no render

operator: pnpm render-matrix --run-id 2026-05-27-001
  → for each hook in types/hooks.ts:
      for each format in [master, social, readmeLoop]:
        npx remotion render <composition> \
          --props='{ "runDir": "~/gflow-output/promo/2026-05-27-001", "hookId": "<id>" }' \
          --output out/promo/2026-05-27-001/<id>-<format>.mp4
  → scripts/post-gif.mjs converts <id>-readmeLoop.mp4 → <id>-readmeLoop.gif

operator: review out/promo/2026-05-27-001/*
         pick keepers
         upload to gflow-cli-remotion GitHub Release (e.g. `v0.1.0-promo-2026-05-27`)
         update gflow-cli/README.md hero link if a new keeper supersedes the old one
```

---

## 5. RunManifest Schema (Zod, source of truth)

```ts
// types/schema.ts
import { z } from "zod";

export const PhaseKind = z.enum(["t2i", "batch", "video", "data"]);

export const StructLogEvent = z.object({
  ts: z.string(),                      // ISO timestamp from gflow
  event: z.string(),                   // structlog event name
  level: z.string(),                   // "info" | "warning" | "error"
  data: z.record(z.string(), z.unknown()),
});

export const Phase = z.object({
  kind: PhaseKind,
  cmd: z.string(),                     // "gflow image t2i ..."
  startedMs: z.number().int(),         // monotonic ms since orchestrator start
  endedMs: z.number().int(),
  exitCode: z.number().int(),
  artifacts: z.array(z.string()),      // basenames in expectedArtifacts dir
  events: z.array(StructLogEvent).default([]), // filtered gflow stream; may be empty
});

export const Recording = z.object({
  source: z.literal("obs"),
  masterPath: z.string(),              // absolute path to master.mp4
  width: z.number().int(),
  height: z.number().int(),
  fps: z.number().int(),
  durationMs: z.number().int(),
});

export const Env = z.object({
  gflowVersion: z.string(),
  nodeVersion: z.string(),
  obsVersion: z.string(),
  os: z.string(),                      // e.g. "win32-10.0.26200"
  browserStrategy: z.literal("chrome"),// MUST be real Chrome, not Chromium
});

export const RunManifest = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),                   // e.g. "2026-05-27-001"
  startedAtIso: z.string(),
  startedAtMonotonic: z.number(),
  profile: z.string(),                 // gflow profile name
  env: Env,
  phases: z.array(Phase).min(1),       // orchestrator enforces v1 4-phase
                                       // invariant at runtime; schema stays
                                       // flexible to avoid schemaVersion churn
                                       // when the tour shape evolves
  recording: Recording,
});

export type RunManifest = z.infer<typeof RunManifest>;
```

**Drift protection.** A CI job in `gflow-cli-remotion` runs `zod-to-json-schema` and asserts the output matches a checked-in `tests/fixtures/run-manifest.schema.json`. If anyone edits the Zod without regenerating the fixture, CI fails.

**Cross-repo contract.** That same JSON Schema is also committed to `gflow-cli/tests/fixtures/run-manifest.schema.json` (one-line copy, not a build dependency). A gflow-cli test asserts that a synthetic `run.json` it constructs from a real `gflow image t2i --dry-run` output validates against the schema. This is the only cross-repo file touched. Future schema bumps require coordinated commits in both repos and a `schemaVersion` increment.

---

## 6. Browser Strategy — Strict

The recording must capture a **headed real Chrome window**, not Playwright's bundled Chromium. This is locked by gflow's existing `real-browser-auth-mandatory` policy. Concretely:

- The named profile (e.g. `denon82`) **must** have been created with `gflow auth login --profile <name> --browser chrome` (the default).
- `record-promo.mjs` reads the actual marker file at `<gflow_profile_dir>/.gflow_browser_strategy` and verifies its content equals literal `"chrome"`. This is independent verification — the orchestrator does NOT trust a self-reported `env.browserStrategy` string in the manifest. If the marker file is missing or its content is anything other than `"chrome"`, abort before spending credits.
- OBS scene captures the Chrome window by its **window class** (not title), because Chrome's title flickers with the active page (`"Google Flow - Chrome"` ↔ `"Loading... - Chrome"`). Window class is stable across navigations. The captured region MUST crop out the top-right Chrome account-chip area; see §9.

---

## 7. Error Handling

| Failure | Detection | Recovery |
|---|---|---|
| `obs-websocket` unreachable | `obs.ts` `connect()` times out at 5 s | Fail fast with message: "OBS not running, or WebSocket Server disabled. Open OBS → Tools → WebSocket Server Settings." Do **not** spawn gflow. |
| OBS-WS auth fails | WS rejects on auth | Same fail-fast. Message names the env var: `OBS_WS_PASSWORD`. |
| `gflow` not on PATH | `which gflow` (or `where.exe gflow`) returns nothing | Fail fast: "Install with `uv tool install gflow-cli`." |
| Chrome-strategy profile missing | Read gflow's profile dir, check for the `chrome` marker file | Fail fast: "Run `gflow auth login --profile <name> --browser chrome` first." |
| gflow phase exits non-zero | `child_process` `exit` event with code !== 0 | Stop OBS, write partial `run.json` with `exitCode` set, exit non-zero. **Do not render.** |
| Missing `phase_completed` event | timeout on `phases.maxDurationMs` | Log warning, kill the child, treat as failure (above). |
| `run.json` validation fails | Zod `safeParse` after assembly | Hard error. The orchestrator should never produce an invalid manifest; this is an internal-bug indicator. |
| Remotion render fails | `npx remotion render` non-zero | `render-matrix.mjs` collects errors per variant; reports a summary at the end. One bad variant doesn't kill the matrix. |

**Idempotency.** Re-running `pnpm record-promo` with the same `--run-id` refuses to overwrite an existing dir (`already exists`). Operator must pass a new `run-id` or `--force`.

**Resumability v1: none.** If a recording dies mid-phase, the take is wasted (credits spent). v2 may add `--resume-from <phase>`. Acceptable for v1 because the full tour is ~5 min and reasonably reliable.

---

## 8. Testing Strategy

### 8.0 Phase 0 prerequisites (devDependencies + scripts)

The Remotion repo's current `package.json` lists ZERO test framework. Phase 0 adds:

| Dep | Purpose |
|---|---|
| `vitest` | Test runner. |
| `@vitest/coverage-v8` | Coverage. |
| `zod-to-json-schema` | Generate JSON Schema from `types/schema.ts` for the contract test and the cross-repo fixture. |
| `obs-websocket-js` (runtime) | Pin to v5+ (challenge-response auth, see §9). |
| `tsx` (dev) | Run the `.mjs` orchestrator scripts in tests with TypeScript imports. |

Scripts added: `test`, `test:contract`, `test:render-smoke`. `tsconfig.json` includes `tests/**/*.test.ts`. `pnpm install --frozen-lockfile` enforced in CI.

### 8.1 Test layers

| Layer | What | Tool |
|---|---|---|
| Unit — schema | Zod schema accepts a known-good fixture (`tests/fixtures/sample-run.json`); rejects 4 malformed fixtures (missing required field, wrong type, extra unknown top-level key, empty `phases`). | vitest |
| Unit — hooks | `hooks.ts` IDs are unique; hook title length fits the composition's hook window (≤3 s × 30 fps = 90 frames of room); `hooks.length` ∈ [3, 12]. | vitest |
| Unit — event stream | `event-stream.ts` parses real captured gflow JSON lines from checked-in `tests/fixtures/gflow-stdout/{t2i,batch,video,data}.jsonl`. Filter predicate (per §4) keeps the allowlist events and drops the rest. | vitest |
| Unit — OBS adapter | `FakeObsAdapter` records calls in-memory; `RealObsAdapter` is tested via a stubbed WS server in `tests/helpers/fake-obs-ws.ts`. | vitest |
| Unit — manifest writer | Round-trip: orchestrator state → `run.json` bytes → Zod parse → equal. | vitest |
| Contract | `zod-to-json-schema(RunManifest)` matches a committed `tests/fixtures/run-manifest.schema.json` snapshot. PR diff IS the breaking-change review. | vitest snapshot |
| Cross-repo contract | `gflow-cli/tests/fixtures/run-manifest.schema.json` is a one-line copy of the same file. `gflow-cli/tests/contracts/test_run_manifest_schema.py` builds a synthetic manifest from a captured `--dry-run` and validates it via `jsonschema.validate()`. | pytest in `gflow-cli`, marker `e2e_data` per `e2e-cost-stratification-pattern` |
| Mock integration | `pnpm record-promo --dry-run --run-id test-001` runs against `tests/fixtures/fake-gflow/*.cmd` (Windows) and `tests/fixtures/fake-gflow/*.sh` (POSIX) stubs that replay checked-in `.jsonl` event streams line-by-line; `FakeObsAdapter` selected via env flag `GFLOW_PROMO_OBS_FAKE=1`. Produces a syntactically valid `run.json` + a 1-frame `master.mp4` (ffmpeg-generated solid color). Zero credits. | vitest |
| Error-row tests | One test per row of §7's error matrix (obs-ws unreachable, obs-ws auth fail, gflow not on PATH, non-Chrome profile, gflow non-zero, missing `phase_completed` timeout, idempotent re-run guard). | vitest |
| Render smoke | `pnpm render-matrix --run-id fixtures/sample-run --only PromoSocial --frames 0-30 --gl swiftshader` renders 30 frames of one variant on CI (no GPU); asserts output file size > 0 and ffprobe shows ≥1 stream. | CI |
| Live verification | One real recording per promo tag. Operator runs the 5-layer ledger checklist documented in `docs/SETUP.md` (committed in this repo): (1) `Get-ChildItem out\promo\<run>\` → expected count = N hooks × 3 formats; (2) magic-bytes per file (`Get-Content -Encoding Byte -TotalCount 16`) — MP4 prefix `00 00 00 ?? 66 74 79 70`, GIF prefix `47 49 46 38`; (3) ffprobe dims per format — 1920×1080 master, 1080×1920 social, 1280×720 readme; (4) eye-test playback — confirm hook text legible, no account-chip leak (§9.1); (5) `xxd` first frame for a PII scan. | Manual; documented script in `docs/SETUP.md` |

### 8.2 CI gates

PR gates: unit + contract + mock integration + error-row + render smoke + `pnpm install --frozen-lockfile`. Per `pre-pr-verification-discipline` memory: **live verification + council review run before `gh pr create`, not after.**

---

## 9. Security & Privacy

### 9.1 Visual leak — Google account chip (must-fix)

The recording captures a headed real Chrome window driving Google Flow. The Flow UI persistently renders an account chip (top-right avatar + email tooltip on hover); transient toasts ("Signed in as …", quota banners, billing nags) can flash for 1-2 frames. A keeper that ships to a public GitHub Release leaks the operator's email by default.

**Mitigations (all required, not etiquette):**

1. **OBS scene crops out the account-chip region by design.** The committed `docs/obs-scene.json` (OBS scene-collection export) includes a `Crop/Pad` filter on the Chrome window-capture source removing the top-right 280×56 px region. Operator imports the scene at OBS startup; no operator-tuned cropping.
2. **CSS user-stylesheet hides the chip during promo runs.** Chrome launched with `--user-data-dir=<promo_profile>` + `--user-stylesheet=<repo>/docs/promo.css` containing `[aria-label*="Google Account" i], [data-tooltip*="@"]{visibility:hidden!important;}`. Validated by a Playwright assertion in mock integration (no chip in screenshot).
3. **Promo profile enforced via name prefix.** `record-promo.mjs` refuses `--profile` unless the name starts with `promo-`. Operator cannot accidentally use a personal profile.
4. **Manual scan still mandated** (defense in depth) per §8.1 live verification ledger layer 4.

### 9.2 Visual prompt leak (must-fix)

The terminal pane shows prompts being typed on camera. `run.json` storing only `prompt_hash` creates false confidence — the keeper MP4 carries the plaintext on screen. Mitigation:

- Prompts used in promo runs MUST be reviewed identically to hook copy (no PII, no internal jargon, no sensitive language).
- A `tests/lint/promo-prompts.test.ts` lints the prompts the orchestrator is allowed to fire (committed list in `types/promo-prompts.ts`) against a banned-phrase set (emails, "secret", "internal", customer names) and a maximum-length rule.

### 9.3 obs-websocket exposure

- **Require obs-websocket v5+ only** (challenge-response auth; older versions had weaker auth). Connection refused otherwise.
- `OBS_WS_PASSWORD` env var REQUIRED — refuse to connect if unset. Document strong-password generation in `docs/SETUP.md`.
- **Localhost is not a trust boundary on a multi-tab browser session.** A malicious tab could reach `ws://127.0.0.1:4455` via DNS rebinding or cross-origin WebSocket (which bypasses CORS). Operator MUST close other browser windows during recording. `docs/SETUP.md` calls this out and recommends a dedicated Chrome window for the recording (separate from any everyday browsing).

### 9.4 Env-var scrubbing for the gflow subprocess

The orchestrator inherits `process.env` wholesale; gflow's child inherits it too. If gflow's debug logging ever dumps env (a crash log, a future diagnostic feature), `OBS_WS_PASSWORD` and any other secrets in shell env land in stdout — and thus in `run.json`. Mitigation: `child_process.spawn(cmd, args, { env: scrubEnv(process.env) })` with an explicit allow-list:

```ts
const ALLOWED = ["PATH", "PATHEXT", "HOME", "USERPROFILE", "APPDATA",
                 "LOCALAPPDATA", "SystemRoot", "TEMP", "TMP",
                 "GFLOW_CLI_PROFILE", "GFLOW_CLI_OUT_DIR",
                 "GFLOW_CLI_LOG_LEVEL"];
const FORBIDDEN_PATTERNS = [/^OBS_WS/, /TOKEN$/, /SECRET$/,
                            /PASSWORD$/, /API_KEY$/, /GH_TOKEN/];
```

Anything not in the allow-list AND not matching a forbidden pattern is dropped. The allow-list is conservative — operators add to it explicitly when a new gflow env var becomes mandatory.

### 9.5 `StructLogEvent.data` is an unbounded leak channel

The Zod schema accepts `z.record(z.string(), z.unknown())` for the `data` payload — any future gflow event with a file path / account ID / prompt fragment flows through to `run.json` silently. Mitigations:

1. **Allow-list per known event type.** `event-stream.ts` knows the expected `data` keys for each Tier 3 event we filter; unknown keys are dropped.
2. **Regex redaction pass before manifest write.** Strip patterns: email (`[\w.+-]+@[\w-]+\.\w+`), Google OAuth refresh tokens (`1//[\w-]+`), JWT (`eyJ[\w-]+\.[\w-]+\.[\w-]+`), Windows user paths (`[A-Z]:\\Users\\[^\\]+\\` → `<user-home>\`), POSIX user paths (`/(Users|home)/[^/]+/` → `/<user-home>/`).
3. Same scrubber will be reused from gflow-cli's planned `observability/redact.py` (event-surface spec Phase 0) once available — until then, the Remotion side carries its own copy.

### 9.6 `event-stream.ts` must be exception-safe (analog to `on-started-callback-recorder-safety`)

The event parser runs synchronously inside the orchestrator's child-stdout pipe. If a JSON parse error or a redaction-regex bug throws, it kills the orchestrator mid-recording — and OBS keeps recording forever. Mitigation: every event handler wrapped in `try/catch`, log+skip on error, continue the pipe. Equivalent of the Python-side recorder-safety pattern.

### 9.7 Supply chain

- **Pin every dependency** via `pnpm install --frozen-lockfile` in CI.
- **Remove `@remotion/lambda`** from `package.json` until v2 actually activates Lambda rendering. Lambda's transitive surface is unjustified for v1's local-render scope. (`@remotion/bundler`, `@remotion/cli`, `@remotion/renderer` stay.)
- **`npm audit --production`** gate on PR (advisory; doesn't block CI but fails the council Memory dim).
- Document a quarterly dep-bump cadence in `docs/SETUP.md`.

### 9.8 `gflow-output/promo/<run-id>/` is also sensitive

The local recording dir contains the un-cropped `master.mp4` (account chip still visible — only the OBS scene crops it for the OUTPUT side, but the input frame buffer is raw). `.gitignore` covers it because it's under `$HOME`, but the spec mandates: operator's `~/.gitignore_global` should include `gflow-output/` to prevent any accidental future repo from committing it.

---

## 10. Open Questions / Risks

1. **`hooks.ts` count.** Bounded by test (3 ≤ length ≤ 12). v1 targets 6 hooks: question / bold-claim / pain / POV / outcome / "before & after" archetypes. Concrete copy is downstream creative work.
2. **Render time.** N hooks × 3 formats × Remotion's per-frame render cost. 6 hooks × 3 = 18 renders; local ~30-60 min on M-series Macs / mid-range x86. If painful, the sibling repo's `@remotion/lambda` plumbing returns as a v2 option (currently removed from deps per §9.7).
3. **OBS scene composition** — locked in `docs/obs-scene.json` (committed); §8.1 live-verification ledger layer 4 catches drift between recordings.
4. **Hook copy quality.** A/B testing only works if the variant pool spans real psychological tactics. Promo-prompts.test.ts lints for banned phrases (§9.2); subjective quality is downstream.
5. **Chrome window-class binding on Windows** — the `obs-scene.json` source uses window class (e.g. `Chrome_WidgetWin_1`), which is stable across navigations. Risk: a Chrome update changes the class. Mitigation: `docs/SETUP.md` documents how to re-bind the source via `Right-click → Properties → Window`.
6. **Forward path to event-surface v2.** Once `gflow-cli`'s public event surface lands (companion spec Phase 1+2), this orchestrator's v2 swaps the Tier 3 dotted-event filter for Tier 1/2 events. The Zod schema bumps `schemaVersion: 1 → 2`; old `run.json` files stay readable via a small adapter. Tracked as a follow-up after the event surface tags `schema_version: 1` stable.
7. **gflow's Tier 3 dotted events are NOT stable API.** v1 explicitly binds to implementation-detail events (`ui_automation.entered_editor`, etc.). If gflow renames them between releases, this orchestrator's `event-stream.ts` filter breaks. Mitigation: the cross-repo contract test (§8.1) pins each event name we depend on; a gflow rename produces a CI failure here BEFORE the next promo recording. The fix is either a one-line filter update OR (better) migrate to the stable event surface (item 6).

---

## 11. Follow-up: delete `scripts/record_demo.ps1` in gflow-cli

Separate PR against `gflow-cli` after this pipeline is verified to produce equivalent output. Per `verify-extraction-claims-from-external-repos` memory, the equivalence gate is **falsifiable**, not assertive:

| Check | Evidence required |
|---|---|
| Final GIF still produced | `out/promo/<run-id>/<hook>-readme.gif` exists, ≤10 MB |
| Same image dimensions | `ffprobe` shows width/height equal to the prior PS1 output (1280×720) |
| Same magic bytes | First 16 bytes of `.gif` are `47 49 46 38` (GIF89a) |
| Same per-PNG dims | Pillow / ffprobe confirms each Imagen artifact matches the PS1's verified dims |
| Live verification ledger | §8.1 layer 5 checklist passes |

Only when ALL five pass does the deletion PR open against gflow-cli. The PR is **`Refs #<issue>`, not `Closes #<issue>`** per `pr-hygiene-revert-and-multi-commit` memory until both repos are at parity.

When the PR ships:
- Delete: `scripts/record_demo.ps1`.
- Update: any docs that mention it (`docs/USER_GUIDE.md`, `RELEASE.md`, `CHANGELOG.md`).
- Branch: `chore/remove-record-demo-script` per `branch-naming-convention` memory.

---

## 12. Out of Scope for This Spec

- The actual Remotion composition design (animations, typography, transitions). Treated as creative work, designed inside Remotion Studio with `@remotion/player` and locked in code later.
- Hook copy.
- The decision of which keepers go where (X / LinkedIn / TikTok / YouTube Shorts) — operator's call per take.
- Lambda configuration for cloud rendering. Sibling has the plumbing; we don't activate it in v1.

---

## Appendix A — Repository Boundary Cheat-Sheet

| Concern | Lives in `gflow-cli` | Lives in `gflow-cli-remotion` |
|---|---|---|
| CLI / library code | ✅ | ❌ |
| Structlog event emission | ✅ (already exists) | ❌ |
| Orchestrating a promo recording | ❌ | ✅ |
| OBS control | ❌ | ✅ |
| Remotion compositions | ❌ | ✅ |
| A/B hook variants | ❌ | ✅ |
| Final renders | ❌ (link only) | ✅ (published as GitHub Release assets) |
| Documentation of the promo pipeline | ❌ | ✅ (this file + `docs/SETUP.md`) |
| Cross-repo schema fixture | one-line copy in `tests/fixtures/` | source of truth in `types/schema.ts` |

---

## Appendix B — Existing Memory Entries Honored

- `real-browser-auth-mandatory` — locked by §6; orchestrator independently verifies `.gflow_browser_strategy` marker file content.
- `verification-ledger-5-layer` — adopted by §8.1 live verification (5 concrete layers documented inline).
- `e2e-tests-parameterize` — `record-promo.mjs` takes `--profile`, `--run-id`, `--phases`, `--dry-run` as CLI args, not hardcoded.
- `windows-dev-quirks` — orchestrator uses Node `child_process.spawn`; Windows path handling tested per the memory's notes on `gh api` path mangling.
- `pre-pr-verification-discipline` — §8.2 explicitly mandates council + scoped test + live verify BEFORE `gh pr create`.
- `pr-must-verify-on-affected-surface` — live verification (§8.1) runs the full tour (t2i + batch + video + data); each affected surface is exercised, not just one golden surface.
- `verify-extraction-claims-from-external-repos` — §11's deletion gate is falsifiable (5 checks), not assertive.
- `pr-hygiene-revert-and-multi-commit` — §11 deletion PR uses `Refs`, not `Closes`.
- `branch-naming-convention` — §11 uses `chore/remove-record-demo-script`.
- `on-started-callback-recorder-safety` — §9.6 applies the analog: orchestrator event handlers wrapped in try/catch so a parse error doesn't kill the recording mid-take.
- `data-layer-test-pollution-trap` — mock integration tests (§8.1) operate in tmp dirs only; no shared state.
- `llm-council-design-spec-validation` — this spec was reviewed by the 5-dim council on 2026-05-27 (1 RED → resolved by path (b); 3 YELLOW → fixes applied; 1 GREEN).

**Not invoked anymore:** the prior draft cited `release-spec-plan-memory-consolidation` as justification for placing the spec in `gflow-cli-remotion`. The memory entry is about gflow-cli's spec-cleanup policy, not a blanket cross-repo placement rule. Spec location here is a separation-of-concerns choice, not a memory-mandated one.
