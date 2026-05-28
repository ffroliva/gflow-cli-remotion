/**
 * Shared visual language for the promo compositions.
 *
 * gflow is a terminal tool, so the promo aesthetic is developer-native:
 * near-black background, monospace type, a single teal accent, restrained
 * motion. Keep this the single source of colour/spacing so the three
 * compositions stay coherent.
 */

import { loadFont } from "@remotion/google-fonts/RobotoMono";

// Pin to the two weights + latin subset the compositions actually use.
// Loading all weights/subsets fires ~80 network requests per render tab,
// which slows the matrix and makes renders fail offline.
const { fontFamily: mono } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export const theme = {
  font: mono,
  bg: "#0a0e14",
  fg: "#e6e6e6",
  dim: "#5c6773",
  accent: "#00e5a0",
  accentDim: "#0a8f66",
} as const;

/** A blinking block cursor opacity for a given frame at the given fps. */
export function cursorOpacity(frame: number, fps: number): number {
  const period = Math.round(fps * 0.5); // ~2 blinks/sec
  return Math.floor(frame / period) % 2 === 0 ? 1 : 0;
}
