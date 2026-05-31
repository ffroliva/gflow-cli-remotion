/**
 * Composition dimensions + fps for the promo render matrix.
 *
 * Master is the long-form 16:9; Social is the 9:16 vertical hook cut;
 * ReadmeLoop is the 16:9 30s silent loop that post-gif.mts turns into a GIF.
 */

export const FPS = 30;

export const MASTER = { width: 1920, height: 1080 } as const;
export const SOCIAL = { width: 1080, height: 1920 } as const;
export const SQUARE = { width: 1080, height: 1080 } as const;
export const README_LOOP = { width: 1280, height: 720 } as const;

// The trimmed / speed-ramped OBS master that the split campaign comps play.
// v2 master = obs-real-005-trim15: ~12.4s with a slower, *felt* generation and
// a ~3s held "breath" on the result (the v1 obs-real-005-trim was 184f/6.1s but
// felt too fast). Comps size their video window to this so there is no dead air.
export const TRIM_VIDEO_FRAMES = 355; // 11.83s @ 30fps (obs-real-005-trim15)

// Terminal sync markers, tied to the obs-real-005-trim15 build (verified via
// out/dev/frames/input_scan.png): editor + model config 0-55f, **prompt text
// populates Flow's input ~60-90f** + submit ~100f, generation 100-218f,
// blur→sharp reveal 218-265f, sharp held 265-355f.
export const TERM_TYPE_END = 75; // command typed ~as Flow's input populates
export const TERM_SPIN_START = 100; // spinner begins as generation starts (sim)
export const TERM_SHARP_VF = 262; // video-relative frame the result resolves sharp

// Terminal-alone lead for the prompt-first sequence: the command is typed on a
// full terminal, THEN the browser slides in (~3.2s).
export const PROMPT_FIRST_LEAD = 96;

// Hook window for the legacy Master title card + Social intro.
// tests/render-smoke/social.test.ts hardcodes "hook ends at frame 75" and
// renders PromoSocial frames 60-90 — keep this at 75.
export const HOOK_DURATION = Math.round(2.5 * FPS); // 75

// Shorter, action-first intro hook for the split-screen campaign comps.
export const SPLIT_HOOK_DURATION = Math.round(1.5 * FPS); // 45

// Typed-caption intro length in ReadmeLoop (kept in sync with its local const).
export const README_INTRO = 45;

// Durations in frames — all sized to the trimmed master (no dead air).
export const MASTER_DURATION = HOOK_DURATION + TRIM_VIDEO_FRAMES; // 259
export const SOCIAL_DURATION = HOOK_DURATION + TRIM_VIDEO_FRAMES; // 259 (>=90 for smoke)
export const README_DURATION = README_INTRO + TRIM_VIDEO_FRAMES; // 229
