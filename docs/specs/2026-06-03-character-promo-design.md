# Design — `gflow character` quick social promo

> **Status:** Approved 2026-06-03. Quick, ship-now social clip for the v0.12.0
> `gflow character` feature. A later long-form "character → reused in a video"
> piece is **out of scope** here (tracked separately).

## Goal & scope

A **~15–20s 9:16 vertical** clip for social (Reels / Shorts / X-vertical) that
showcases `gflow character create` — the one-command creation of a **reusable,
consistent Character** (face reference + front/side/back triptych body). Optimized
to ship today and to be **A/B tested** across several hook angles.

Built entirely in this repo (`gflow-cli-remotion`) on `feature/character-promo`.
**gflow-cli is never modified** (hard boundary). **Zero credits** — reuses real
artifacts already generated during the v0.12.0 character live-verify (2026-06-02).

## Constraints

- Remotion invariants: **no CSS transitions/animations** (use `interpolate()` +
  `useCurrentFrame()`), **no Tailwind animation classes**, assets in `public/` via
  `staticFile()`. (Load `skills/remotion/SKILL.md` before editing the composition.)
- Repo conventions: composition under `src/remotion/promo/`; shared visual language
  from `src/remotion/promo/theme.ts`; dimensions from `types/constants.ts`
  (`SOCIAL` = 1080×1920, `FPS`); props pattern `{ runDir, hookId, hookTitle,
  hookSubtitle }` like the existing promos.
- **Browser shot is animated** (CommandCard house-style), **not** OBS capture this
  round — real screen-capture is deferred to the long-form piece (hybrid decision).

## Composition

New component `src/remotion/promo/CharacterPromo.tsx` + a Zod schema
`characterPromoSchema` (props: `runDir`, `faceFile`, `bodyFile`, `hookId`,
optional `hookTitle`/`hookSubtitle`). Registered in `src/remotion/Root.tsx` as one
9:16 composition **per hook** (mirrors the `WorkflowPromo-<closer>` /
`pipelineHooks.map` pattern) so each variant renders to its own id.

Layout: split-screen — a **terminal** panel (typed `gflow character create …`,
reuse the existing `Terminal` component / typing approach) above an **animated
editor panel** (CommandCard-style) that "fills" the face slot then the body slot,
revealing the real images. Visual tokens from `theme.ts`.

## Assets (0 credits, reuse)

Source (already on disk, from the 2026-06-02 character live-verify, entity `04ec1e8a`):
- `…/Downloads/gflow-cli/characters/2026-06-02/character_04ec1e8a-…_slot0.jpg` → **face**
- `…_slot1.jpg` → **front/side/back triptych body**

Copy both into `public/captures/character-marina/` as `face.jpg` and
`body-triptych.jpg`; reference via `staticFile()` (the `runDir`/`faceFile`/`bodyFile`
props resolve to these). The face asset is **landscape (~16:9)** — render it inside a
framed card within the vertical frame (not full-bleed). The reused character is a
woman (short dark hair, glasses, navy sweater); on-screen name **Marina** — a demo
label chosen to suit the face, not tied to a specific DB entity.

## Shot timeline (~18s @ 30 fps ≈ 540 frames)

| Window | Beat |
|---|---|
| 0–3s | Hook caption (per-variant text — see matrix) |
| 3–7s | Terminal types `gflow character create --name Marina --face-prompt "a woman with short dark hair, round glasses, navy sweater, soft studio portrait" --voice <Name> --personality "…"` |
| 7–11s | Animated editor panel: face slot fills → **face.jpg** reveal |
| 11–16s | **triptych body** slides in; caption *"front · side · back — one generation, consistent"* |
| 16–18s | CTA card: *"gflow character · new in v0.12.0 · `pip install -U gflow-cli` · ★ github.com/ffroliva/gflow-cli"* |

All motion via `interpolate()`/`spring()` on `useCurrentFrame()`. Durations are a
starting point; tune in Studio.

## A/B variant matrix (campaign test)

Same timeline, swappable hook caption — one comp id each:

| `hookId` | Hook line |
|---|---|
| `question` | "What if your AI character looked the same in every shot?" |
| `pain` | "Your AI subject keeps changing face. Fix it in one command." |
| `flex` | "One command → a reusable character: face, body, voice." |
| `dev` | "Consistent characters, straight from your terminal." |

## Companion social copy

`promo/character/social.md` — X and LinkedIn post variants (hook + 2–3 lines +
`pip install -U gflow-cli` + release/docs links + hashtags), one block per hook
angle so copy matches each rendered video variant.

## Build & QA

- Gates before commit: `pnpm lint && pnpm exec tsc --noEmit && pnpm test:ci`, plus
  full `pnpm test` (render-smoke) since a composition is added.
- Preview in `pnpm remotion` (Studio); render variants:
  `pnpm render CharacterPromo-<hook> out/character-<hook>-9x16.mp4`.
- Deliverables: 4 × 9:16 MP4 (one per hook) + `promo/character/social.md`.

## Out of scope (follow-ups)

- Real OBS browser capture + the long-form "create a character → use it across a
  video chain" piece (the v0.12.0 combined showcase) — separate spec.
- Other aspect ratios (16:9 / 1:1 / GIF) — add later if the vertical performs.
- Voice playback / audio — silent clip for v1.
