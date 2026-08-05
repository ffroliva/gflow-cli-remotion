/**
 * A/B hook variants for the promo render matrix.
 *
 * Each hook drives the first ~2.5s of PromoSocial (and the title card of
 * PromoMaster). render-matrix fans out every hook × every composition, so
 * keep this list tight — N hooks × 3 formats renders can get expensive.
 *
 * Constraints (enforced by tests/unit/hooks.test.ts):
 *   - 3–12 entries
 *   - unique kebab-case ids
 *   - title ≤32 chars (fits the hook window without wrapping)
 *   - subtitle ≤80 chars
 */

export interface Hook {
  id: string;
  title: string;
  subtitle: string;
  durationMs: number;
}

export const hooks: readonly Hook[] = [
  {
    id: "question",
    title: "Tired of clicking through Flow?",
    subtitle: "Drive Veo and Imagen from your terminal.",
    durationMs: 2500,
  },
  {
    id: "claim",
    title: "100 Veo clips in one command.",
    subtitle: "Batch orchestration, locally.",
    durationMs: 2500,
  },
  {
    id: "pain",
    title: "Done dragging files by hand.",
    subtitle: "gflow runs the browser UI for you.",
    durationMs: 2500,
  },
  {
    id: "pov",
    title: "POV: your CLI talks to Veo.",
    subtitle: "Yes — really.",
    durationMs: 2500,
  },
  {
    id: "outcome",
    title: "Prompt to MP4 in one line.",
    subtitle: "Watch.",
    durationMs: 2500,
  },
  {
    id: "before-after",
    title: "Before: 47 clicks. After: 1.",
    subtitle: "gflow image batch.",
    durationMs: 2500,
  },

  // ── Story hooks (docs/PROMO_STORY.md) ─────────────────────────────────────
  // The six above open on a workflow complaint: clicking, dragging, counting
  // clicks. That lands with people already using Flow heavily. These three open
  // on the CONSISTENCY problem instead — the wall you hit the moment you try to
  // make anything longer than a single shot, and the one thing a chat box
  // genuinely cannot do. Kept alongside rather than replacing, so the matrix
  // A/B-tests the two angles instead of assuming this one wins.
  {
    id: "scene-seven",
    title: "Scene 7. Different face.",
    subtitle: "Every AI image tool does this. Here is the fix.",
    durationMs: 2500,
  },
  {
    id: "same-face",
    title: "Same character. Every scene.",
    subtitle: "Not one at a time — in a loop, from your terminal.",
    durationMs: 2500,
  },
  {
    id: "who-is-this",
    title: "Who is this? Not your hero.",
    subtitle: "AI forgets. gflow character makes it remember.",
    durationMs: 2500,
  },
];
