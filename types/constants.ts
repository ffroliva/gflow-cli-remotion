/**
 * Composition dimensions + fps for the promo render matrix.
 *
 * Master is the long-form 16:9; Social is the 9:16 vertical hook cut;
 * ReadmeLoop is the 16:9 30s silent loop that post-gif.mts turns into a GIF.
 */

export const FPS = 30;

export const MASTER = { width: 1920, height: 1080 } as const;
export const SOCIAL = { width: 1080, height: 1920 } as const;
export const README_LOOP = { width: 1280, height: 720 } as const;

// Durations in frames (at FPS).
export const MASTER_DURATION = 90 * FPS; // up to 90s long-form
export const SOCIAL_DURATION = 60 * FPS; // 60s vertical
export const README_DURATION = 30 * FPS; // 30s loop

// Hook display window shared by Master title card + Social intro.
export const HOOK_DURATION = Math.round(2.5 * FPS);
