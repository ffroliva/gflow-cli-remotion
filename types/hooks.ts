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
];
