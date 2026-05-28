# Docs Index

Routing layer for `gflow-cli-remotion`. Start here.

| Doc | Purpose | Read when… |
|-----|---------|------------|
| [README](../README.md) | Project overview, pipeline diagram, quick start | First time landing on the repo |
| [AGENTS.md](../AGENTS.md) | Universal coding-agent spec — Cursor / Codex / Aider / Gemini CLI / etc. | Any AI agent enters the repo |
| [CLAUDE.md](../CLAUDE.md) | Claude Code session protocol (delegates universal rules to AGENTS.md) | Claude Code opens the repo |
| [SETUP.md](SETUP.md) | Operator runbook: OBS + promo profile setup, record → render → GIF, 5-layer verification ledger | Recording or rendering a promo |
| [promo.css](promo.css) | Chrome user-stylesheet hiding the account chip | Setting up the promo profile |
| [design spec](specs/2026-05-27-promo-pipeline-design.md) | Why the pipeline is shaped the way it is | You want architectural intent |
| [implementation plan](superpowers/plans/2026-05-27-promo-pipeline.md) | Task-by-task build plan (with inline amendments) | Resuming or auditing the build |

## Command map

| Command | Does |
|---------|------|
| `pnpm record-promo --profile promo-XYZ --run-id <id>` | Record a tour under OBS → `run.json` + `master.mp4` |
| `pnpm record-promo … --dry-run` | Same flow against fixture stubs (no OBS, no credits) |
| `pnpm render-matrix --run-id <id>` | Fan out hooks × formats → `out/promo/<id>/` |
| `pnpm render-matrix --run-id <id> --only PromoSocial --frames 30` | Cheap single-composition smoke |
| `pnpm post-gif --run-id <id>` | README loop → optimized GIF |
| `pnpm remotion studio` | Full composition preview |
| `pnpm dev` | In-browser hook switcher preview |
| `pnpm test` / `pnpm test:ci` | Full suite / CI subset (no render-smoke) |

## Architecture map

| Path | Role |
|------|------|
| `types/schema.ts` | Zod `RunManifest` — single source of truth for the gflow-cli contract |
| `types/hooks.ts` · `types/promo-prompts.ts` | A/B hook variants · vetted public-safe prompts |
| `src/orchestrator/` | profile-check, env-scrub, redact, event-stream, phases, manifest, run-paths |
| `scripts/*.mts` | record-promo · render-matrix · post-gif entrypoints |
| `src/remotion/promo/` | PromoMaster · PromoSocial · ReadmeLoop · theme |
| `tests/{unit,integration,contract,render-smoke,lint}` | layered test suite |
