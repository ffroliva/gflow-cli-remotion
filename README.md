# gflow-cli-remotion

> **Promo pipeline for [gflow-cli](https://github.com/ffroliva/gflow-cli).** Record a real `gflow` demo tour with OBS, then render A/B promo variants (16:9 master, 9:16 social, README GIF) with [Remotion](https://remotion.dev).

[![CI](https://github.com/ffroliva/gflow-cli-remotion/actions/workflows/ci.yml/badge.svg)](https://github.com/ffroliva/gflow-cli-remotion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org)
[![Remotion](https://img.shields.io/badge/Remotion-4.x-0b84f3.svg)](https://remotion.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org)
[![Code style: Prettier](https://img.shields.io/badge/code%20style-prettier-ff69b4.svg)](https://prettier.io)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

> 🧪 **Alpha, local-first.** This is a personal content-production tool, not a hosted service. It drives [gflow-cli](https://github.com/ffroliva/gflow-cli) (itself an unofficial Google Flow CLI) and spends real Veo/Imagen credits when recording.

## What this is

A Node + Remotion pipeline that turns a live `gflow` session into shareable promo clips, in three stages:

1. **Record** — `record-promo` drives `gflow` through a 4-phase tour (text-to-image → batch → text-to-video → data) while OBS captures the screen. It writes a Zod-validated `run.json` manifest next to the `master.mp4`.
2. **Render** — `render-matrix` reads the manifest + master recording and fans out **N hooks × 3 formats** via Remotion compositions.
3. **Package** — `post-gif` turns the README loop into an optimized GIF (ffmpeg + gifski).

It never modifies the sibling `gflow-cli` library — it consumes `gflow`'s existing stdout event stream as a child process.

## How it works

```
record-promo.mts ──drives──> gflow (child process)   ┐
        │                                             │ OBS records the screen
        │  parses stdout JSONL (redacted)             │
        ▼                                             ▼
   run.json  ◄── Zod RunManifest ──┐            master.mp4
        │                          │
        ▼                          ▼
render-matrix.mts ──> Remotion ──> out/promo/<run-id>/
        │              PromoMaster (1920×1080)
        │              PromoSocial (1080×1920)  × N hooks
        │              ReadmeLoop  (1280×720)
        ▼
   post-gif.mts ──ffmpeg+gifski──> readme.gif
```

## Quick start

Full prerequisites and one-time setup (OBS, promo Chrome profile, the 5-layer verification ledger) are in **[docs/SETUP.md](docs/SETUP.md)**.

```bash
pnpm install

# Record a tour (OBS running, OBS_WS_PASSWORD exported, promo-* profile logged in)
pnpm record-promo --profile promo-XYZ --run-id 2026-05-28-001

# Render every hook × format
pnpm render-matrix --run-id 2026-05-28-001

# README loop → GIF
pnpm post-gif --run-id 2026-05-28-001
```

No credits handy? `pnpm record-promo --profile promo-test --dry-run` runs the whole orchestrator against fixture stubs.

Preview compositions locally: `pnpm remotion studio` (full playback) or `pnpm dev` (in-browser hook switcher; the `file://` master recording won't load in a browser).

## Outputs

| Stage | Location |
|-------|----------|
| recording | `~/gflow-output/promo/<run-id>/{run.json, master.mp4}` |
| renders | `./out/promo/<run-id>/{<hook>-master.mp4, <hook>-social.mp4, readme.mp4}` |
| GIF | `./out/promo/<run-id>/readme.gif` |

## Documentation

Start at **[docs/INDEX.md](docs/INDEX.md)** — it routes to everything:

| Doc | Purpose |
|-----|---------|
| [docs/SETUP.md](docs/SETUP.md) | Operator runbook + verification ledger |
| [AGENTS.md](AGENTS.md) | Universal entry point for AI coding agents |
| [CLAUDE.md](CLAUDE.md) | Claude Code session protocol |
| [design spec](docs/specs/2026-05-27-promo-pipeline-design.md) | Why the pipeline is shaped this way |
| [implementation plan](docs/superpowers/plans/2026-05-27-promo-pipeline.md) | Task-by-task build plan |

## Relationship to gflow-cli

This repo is a **consumer** of [gflow-cli](https://github.com/ffroliva/gflow-cli). It shells out to the installed `gflow` binary and parses its structlog output. By design it adds **nothing** to the gflow-cli repo — the contract between them is the JSON Schema in [`tests/fixtures/run-manifest.schema.json`](tests/fixtures/run-manifest.schema.json), validated by [`tests/contract`](tests/contract).

## Status

Alpha. The orchestrator, render matrix, and three compositions are built and tested (dry-run + headless render-smoke); visual polish and the first live recording are pending. Local-first by intent — there is no hosted service and no telemetry.

## Tech stack

Node 20+ · TypeScript · Remotion 4.x · React 19 · Zod · Vitest · obs-websocket-js · ffmpeg + gifski.

## License

[MIT](LICENSE) © Flavio Oliva
