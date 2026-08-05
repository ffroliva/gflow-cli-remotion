# Promo Story — "Scene 7"

**Status:** Ready to capture · **Written:** 2026-08-05 · **Runtime:** ~45s social / ~75s master

The shot list for a capture session. `docs/RECORDING.md` covers *how* to record;
this covers *what to record and in what order*, so the footage tells a story
instead of listing features.

---

## Why not the current phase list

`src/orchestrator/phases.ts` captures a feature tour: `t2i` → `batch` → `video`
→ `data list`. Four capabilities, in sequence. That is a product demo, and
product demos are watched by people who have already decided to care.

A promo has to earn the next three seconds from someone who has not.

## The story

**Everyone can make one image. Almost nobody can make the same person twice.**

That is the real wall, and it is the one thing gflow does that a chat box
cannot. It is also true — `gflow character create` mints a Flow Character with
face and body references, which is why the same subject survives across
generations.

So the promo is not "look what it does." It is a problem you have already hit,
followed by the fix.

### Three beats

| beat | what the viewer sees | why it is there |
|---|---|---|
| **1 · The easy part** | One command, one image, ~4s. No commentary. | Establishes competence and gives nothing away. The viewer thinks "fine, I can do that in Gemini." That thought is the setup. |
| **2 · The turn** | Same prompt again, different face. Two stills side by side, held ~2s. | The problem, shown not stated. Anyone who has tried to make a sequence feels this immediately. |
| **3 · The fix** | `gflow character create`, then a loop. Four scenes, one face. | The payoff. Crucially it is a *loop* — the point is not one good image, it is repeatability. |

Then a hard cut to the command that produced it. End card. No music sting, no
logo spin.

---

## Shot list

Run these in order during the OBS capture. Timings are the *edit* target; record
generously and trim in the composition.

### Beat 1 — the easy part (~8s of footage → ~5s in edit)

```bash
gflow image t2i "a lighthouse keeper at dusk, weathered face, 35mm" --aspect 9:16
```

Let the terminal output stream. Let the image resolve in Flow. **Do not cut
away early** — the whole point is that this part is unremarkable and fast.

### Beat 2 — the turn (~10s → ~4s)

```bash
gflow image t2i "the same lighthouse keeper, now on the pier at night" --aspect 9:16
```

Deliberately *without* a character. It will be a different person. That is the
shot.

> **Capture note:** this beat only works if the faces genuinely differ. If the
> two happen to look alike, run it again — a weak turn kills the whole piece.
> This is the one beat that can fail on the day.

### Beat 3 — the fix (~35s → ~20s)

```bash
gflow character create "Aldous" --from-image out/lighthouse-keeper.png

for s in "on the pier at night" "in the lamp room at dawn" \
         "walking the cliff path in rain" "asleep in a chair, lamp burning"; do
  gflow image t2i "Aldous, $s" --aspect 9:16
done
```

Record the whole loop. Four generations, one face. The repetition **is** the
argument — resist trimming it to two.

### End card (~3s)

```
gflow-cli
pip install gflow-cli
```

Third line, small: `unofficial · alpha · needs Google AI Ultra or Pro`.

That line is not legal boilerplate. It is the reason the piece is credible to
the audience most likely to try it, and leaving it off is how a technical
audience decides you are selling something.

---

## What this needs that the current phases do not

`phases.ts` has no `character` phase, so beat 3 cannot be driven by the
orchestrator as written. Options, cheapest first:

1. **Capture manually.** Run the commands by hand in the recorded terminal. No
   code change; the orchestrator is a convenience, not a requirement.
2. **Add a `character` phase** to `phases.ts` and drive it. Correct long-term,
   but it changes capture orchestration that cannot be tested without a live
   Flow session — so do it when the story has proven itself, not before.

Start with (1). One good capture is worth more than a tidy pipeline that has
never produced an asset.

## Formats out of one capture

A single `master.mp4` in `public/` feeds `render-matrix`, which fans every hook
across all three compositions:

- `PromoMaster` 1920×1080 — the full story, YouTube and the repo.
- `PromoSocial` 1080×1920 — beats 2 and 3 only. **The easy part is cut**; on a
  vertical feed the turn has to land in the first two seconds. Note this
  composition *letterboxes* the 16:9 master rather than reframing it.
- `ReadmeLoop` 1280×720 — beat 3 alone, looping. Four scenes, one face, no
  hook, no end card.

## Hooks that fit this story

`types/hooks.ts` gains three variants written for the turn rather than for the
workflow complaint: `scene-seven`, `same-face`, `who-is-this`. The existing six
still work for a feature-tour cut and are left in place — the render matrix
fans across all of them, so the story is A/B-tested against the pain-point
angle instead of replacing it on assertion.

### Which to shoot — decided 2026-08-05

All three were rendered as 1080×1920 stills and compared side by side.

**`scene-seven` leads.** It is the only one that makes the viewer *feel* the
problem before naming it: "Scene 7" implies a project already six shots deep,
so the failure lands as a loss rather than as a feature gap. It is also the
shortest title, so it renders largest — which is what matters at thumb
distance.

**`same-face` is the A/B partner.** It is the variant that survives without the
video: read cold as a still, "Same character. Every scene." still communicates
the product, where "Scene 7. Different face." is cryptic without the footage
that follows. Worth running against `scene-seven` precisely because it fails
differently.

**`who-is-this` is out of rotation.** "AI forgets" is vague, and the subtitle
spends its length naming a feature (`gflow character`) instead of paying off
the hook. Kept in `hooks.ts` rather than deleted — an unused variant costs
nothing and the matrix can be pointed at it later — but it is not part of the
first cut.

### Render note

The stills were produced with:

```bash
npx remotion still PromoSocial out/hooks/<id>.png --frame=45 \
  --props='{"runDir":"","hookTitle":"…","hookSubtitle":"…"}'
```

Passing props through PowerShell flattened the em-dash in `same-face` to a
hyphen. `types/hooks.ts` is correct; only the still was affected. Verify the
dash survives in the real render rather than trusting the preview.
