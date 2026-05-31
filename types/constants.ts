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

// The trimmed OBS master that the split campaign comps play.
// v3 master = pipeline-002-trim01: 10.23s window (original t=34–44.3s), starting
// mid-generation at ~40% so the viewer joins mid-action and watches the reveal.
// Source goes black at t=44.5s (browser transition); trimmed safely before that.
export const TRIM_VIDEO_FRAMES = 307; // 10.23s @ 30fps (pipeline-002-trim01)

// Terminal sync markers, tied to pipeline-002-trim01 (trim starts at t=34s of the
// original, so the command was already submitted; we type quickly and spin immediately).
// "done" state appears at the last second as the image is nearly formed in the browser.
export const TERM_TYPE_END = 20; // fast type (command pre-entered, just animating)
export const TERM_SPIN_START = 25; // spinner starts immediately after type
export const TERM_SHARP_VF = 285; // composition frame ~330: "done" for ~0.9s before end

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
