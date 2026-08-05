#!/usr/bin/env bash
# Capture the "Scene 7" story — docs/PROMO_STORY.md
#
# Runs the three beats in order against live Flow. Start OBS recording BEFORE
# invoking this and stop it after; the script deliberately does not drive OBS,
# because phases.ts has no `character` phase and beat 3 is the whole point.
#
#   PROJECT=<flow-project-id> ./scripts/capture-story.sh <profile> [outdir]
#
# Images are credit-free (only Veo video spends credits), so a botched take
# costs nothing but time — re-run it.
#
# NOTE: Flow returns JPEG. Passing `-o foo.png` yields foo.jpg on disk.
#
# PREREQUISITE: a live session. `gflow auth list` shows "present" for a saved
# session FILE, which is not the same as a valid one — an expired session still
# reads "present" and fails at project creation with AuthExpiredError (exit 3).
# Verify with the beat-1 command below before starting OBS, so a dead session
# does not cost you a recording take.

set -euo pipefail

PROFILE="${1:?usage: capture-story.sh <profile> [outdir]}"
OUT="${2:-tmp/promo}"
mkdir -p "$OUT"

gf() { GFLOW_CLI_PROFILE="$PROFILE" gflow "$@"; }

echo "── Beat 1 · the easy part ───────────────────────────────────"
# Unremarkable on purpose. The viewer thinks "I could do that in Gemini" —
# that thought is the setup for beat 2.
gf image t2i \
  "a weathered lighthouse keeper at dusk, deeply lined face, grey beard, wool sweater, cinematic 35mm portrait" \
  --aspect 9:16 -o "$OUT/beat1-keeper.png"

echo "── Beat 2 · the turn ────────────────────────────────────────"
# Same subject described in words, NO character binding. It will be a
# different person. That is the shot.
#
# If these two faces happen to look alike the turn dies and the take is
# wasted — check before moving on, and re-run this beat if needed.
gf image t2i \
  "the same weathered lighthouse keeper, now on the pier at night, lantern in hand" \
  --aspect 9:16 -o "$OUT/beat2-stranger.png"

echo "── Beat 3 · the fix ─────────────────────────────────────────"
# The payoff. A LOOP, not a single image: repeatability is the argument.
#
# VERIFIED 2026-08-05. `character create` does NOT take an existing image --
# it GENERATES the reference from --face-prompt (and optional --body-prompt),
# and it requires --project. An earlier version of this script guessed
# `--from-image` and was wrong. Keep the face prompt close to the beat-1
# prompt so the character reads as the same man.
#
# PROJECT is the Flow project id that beat 1 created. Find it with:
#   gflow project list --limit 3
PROJECT="${PROJECT:?set PROJECT=<flow-project-id> (see: gflow project list)}"

gf character create   --project "$PROJECT"   --name "Aldous"   --face-prompt "weathered lighthouse keeper, deeply lined face, close-cropped grey beard, pale blue eyes, dark navy wool beanie, cinematic 35mm portrait"   --body-prompt "navy cable-knit fisherman sweater, dark trousers, weathered hands"

# The character is referenced by @-mention in the prompt, and the generation
# must target the SAME project the entity lives in.
i=1
for scene in   "on the pier at night, lantern in hand"   "in the lamp room at dawn, brass and glass"   "walking the cliff path in heavy rain"   "asleep in a chair, lamp still burning"; do
  gf image t2i "@Aldous, $scene" --project "$PROJECT" --aspect 9:16 -o "$OUT/beat3-scene$i.png"
  i=$((i + 1))
done

echo
echo "Done. Six stills in $OUT/"
echo "  beat1-keeper.png     establishing shot"
echo "  beat2-stranger.png   the turn — must NOT match beat 1"
echo "  beat3-scene1..4.png  the fix — must ALL match beat 1"
echo
echo "Check the faces before you trust the take. If beat 2 matches beat 1, or"
echo "any beat-3 scene does not, the story does not land and it needs a re-run."
