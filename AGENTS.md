# AGENTS.md — gflow-cli-remotion

> Universal entry point for AI coding agents. Read this first; everything else routes from here. Auto-discovered by Cursor, Codex, Aider, Gemini CLI, Jules, Copilot, and others.

## Project at a glance

- A Node + Remotion **promo pipeline** that records a live [gflow-cli](https://github.com/ffroliva/gflow-cli) demo with OBS and renders A/B promo variants.
- TypeScript (strict) · Remotion 4.x · React 19 · Zod · Vitest · obs-websocket-js · tsx · pnpm. System binaries: ffmpeg + gifski.
- Three layers:
  - **Orchestrator** (`src/orchestrator/`, entry `scripts/record-promo.mts`) — drives `gflow` as a child process under OBS, parses its stdout JSONL, writes a Zod-validated `run.json`.
  - **Compositions** (`src/remotion/promo/`) — `PromoMaster` (1920×1080), `PromoSocial` (1080×1920), `ReadmeLoop` (1280×720).
  - **Render scripts** (`scripts/render-matrix.mts`, `scripts/post-gif.mts`) — fan out hooks × formats, then GIF.
- The contract with gflow-cli is the JSON Schema in `tests/fixtures/run-manifest.schema.json` (the Zod source of truth is `types/schema.ts`).

## Hard boundaries

- **Never modify the sibling `gflow-cli` repo** to serve this one. This pipeline is a pure consumer: it shells out to the installed `gflow` binary and reads its existing structlog events. No new gflow events, no test fixtures, no deps added there.
- **Credit safety.** `record-promo` only accepts a `--profile` starting with `promo-`, and aborts unless the profile's `.gflow_browser_strategy` marker reads `chrome`. Do not weaken these guards — they stop paid runs from hitting the wrong account or a broken browser strategy.
- **No secrets in the manifest.** All `gflow` stdout passes through `src/orchestrator/redact.ts` before landing in `run.json`; the child process env is filtered by `src/orchestrator/env-scrub.ts`. Extend the rules, never bypass them.

## Dev environment tips

- `pnpm install` once. Scripts run via `tsx` (TypeScript ESM) — note the `.mts` extension: Node rejects TS syntax in `.mjs`.
- Recording needs OBS running with the WebSocket server enabled and `OBS_WS_PASSWORD` exported. See [docs/SETUP.md](docs/SETUP.md).
- `record-promo --dry-run` exercises the full orchestrator against `tests/fixtures/fake-gflow` stubs — no OBS, no credits.
- Outputs are gitignored: recordings under `~/gflow-output/`, renders under `./out/`.

## Testing instructions

Run before every commit:

```bash
pnpm lint              # eslint
pnpm exec tsc --noEmit # types (vitest uses esbuild and does NOT typecheck)
pnpm test:ci           # unit + integration + contract + lint tests
```

- `pnpm test` additionally runs the chromium-heavy render-smoke (a real headless 30-frame render). CI runs `test:ci`; run the full `pnpm test` locally when touching compositions.
- Integration tests spawn real `tsx scripts/record-promo.mts` subprocesses against the fake-gflow stubs — they exercise the same path live recordings take.
- TDD: write the failing test first for orchestrator/parser/schema logic. Compositions are verified by the render-smoke + manual Studio review.

## Remotion skill

When writing or modifying any Remotion composition, **load the Remotion skill first**:

- **Skill file:** [`skills/remotion/SKILL.md`](skills/remotion/SKILL.md) — core Remotion best practices (animation, sequences, assets, compositions, rendering).
- **Supplementary rules** in [`skills/remotion/rules/`](skills/remotion/rules/) — load on demand based on the task:

| Task | Rule file |
|------|-----------|
| Captions / subtitles | `rules/subtitles.md` |
| Display captions | `rules/display-captions.md` |
| Import SRT captions | `rules/import-srt-captions.md` |
| Transcribe captions | `rules/transcribe-captions.md` |
| FFmpeg operations | `rules/ffmpeg.md` |
| Silence detection | `rules/silence-detection.md` |
| Audio visualization | `rules/audio-visualization.md` |
| Sound effects | `rules/sfx.md` |
| 3D (Three.js / R3F) | `rules/3d.md` |
| Advanced audio | `rules/audio.md` |
| Dynamic metadata | `rules/calculate-metadata.md` |
| Composition nesting/stills | `rules/compositions.md` |
| Google Fonts | `rules/google-fonts.md` |
| Local fonts | `rules/local-fonts.md` |
| Audio duration | `rules/get-audio-duration.md` |
| Video dimensions | `rules/get-video-dimensions.md` |
| Video duration | `rules/get-video-duration.md` |
| GIFs | `rules/gifs.md` |
| Images (sizing, dynamic) | `rules/images.md` |
| Light leaks | `rules/light-leaks.md` |
| Lottie animations | `rules/lottie.md` |
| HTML in canvas | `rules/html-in-canvas.md` |
| Measuring DOM nodes | `rules/measuring-dom-nodes.md` |
| Measuring text | `rules/measuring-text.md` |
| Advanced sequencing | `rules/sequencing.md` |
| TailwindCSS | `rules/tailwind.md` |
| Text animations | `rules/text-animations.md` |
| Advanced timing | `rules/timing.md` |
| Transitions | `rules/transitions.md` |
| Transparent video | `rules/transparent-videos.md` |
| Trimming | `rules/trimming.md` |
| Advanced videos | `rules/videos.md` |
| Parameterized compositions | `rules/parameters.md` |
| Maps | `rules/maplibre.md` |
| Voiceover (ElevenLabs) | `rules/voiceover.md` |

Key invariants enforced by the skill — never violate these:
- **No CSS transitions or animations** — they do not render correctly; use `interpolate()` + `useCurrentFrame()`.
- **No Tailwind animation classes** — same reason.
- Assets go in `public/`; reference them via `staticFile()`.

## Code style

- Prettier-formatted, eslint-clean, `tsc --noEmit` clean. Strict TypeScript.
- Prefer small pure modules in `src/orchestrator/`; keep side effects (spawn, OBS, fs) in the `scripts/*.mts` entrypoints.
- Compositions read props (runDir, hookId/Title/Subtitle, caption); shared visual language lives in `src/remotion/promo/theme.ts`.

## PR instructions

- Branch off `main` with a `feature/`, `fix/`, `chore/`, `docs/`, or `test/` prefix.
- Keep distinct fixes as separate commits; commit messages explain the **why**.
- A PR opens green: lint + tsc + `test:ci` pass, and any composition change has a passing render-smoke.

## Where to look next

- [docs/INDEX.md](docs/INDEX.md) — routing layer for all docs.
- [docs/SETUP.md](docs/SETUP.md) — operator runbook + 5-layer verification ledger.
- [CLAUDE.md](CLAUDE.md) — Claude Code session protocol.
- `docs/specs/` + `docs/superpowers/plans/` — design spec + implementation plan.
