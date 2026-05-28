# CLAUDE.md

> Project memory hub for **Claude Code**. The universal coding-agent rules for any tool (Cursor, Codex, Aider, Gemini CLI, etc.) live in [AGENTS.md](AGENTS.md) — this file carries Claude-Code-specific session protocol only.

## What this project is

`gflow-cli-remotion` is a Node + Remotion promo pipeline that records a live [gflow-cli](https://github.com/ffroliva/gflow-cli) demo tour with OBS and renders A/B promo variants (16:9 master, 9:16 social, README GIF). It is a **consumer** of gflow-cli and never modifies that repo. See [README.md](README.md) for the user-facing overview.

## On every session start

1. Read **[AGENTS.md](AGENTS.md)** — universal rules every agent must follow (hard boundaries, credit safety, redaction).
2. Read **[docs/INDEX.md](docs/INDEX.md)** — routing layer for all docs.
3. Pull deeper context on demand:
   - Recording / rendering / verifying → [docs/SETUP.md](docs/SETUP.md)
   - Design intent → `docs/specs/`
   - Task-by-task plan → `docs/superpowers/plans/`

## Before any commit

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test:ci
```

Run the full `pnpm test` (includes the headless render-smoke) when touching anything under `src/remotion/`.

## Claude-Code-specific

- Scripts are `.mts` (TypeScript ESM) run via `tsx` — Node rejects TS syntax in `.mjs`.
- Auto-memory for the gflow-cli family lives under `~/.claude/projects/C--development-github-gflow-cli/memory/MEMORY.md`; cross-repo boundary rules and verification discipline are recorded there.
- This repo is local-first: no hosted service, no telemetry, no SaaS layer.
