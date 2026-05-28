/**
 * Allow-list of public-safe prompts for promo recordings.
 *
 * Only prompts from this list should ever drive a credit-spending promo run —
 * they're vetted to contain no PII, no internal references, no email handles,
 * and no angle-bracket placeholders (enforced by tests/lint/promo-prompts.test.ts).
 */

export const PROMO_PROMPTS: readonly string[] = [
  "a quiet mountain lake at dawn, cinematic photography",
  "neon-lit Tokyo street at night, low angle, anamorphic",
  "minimalist Scandinavian living room, warm window light",
  "macro shot of dewdrops on a spider web at sunrise",
  "vintage 1970s film aesthetic of a roadside diner at dusk",
];
