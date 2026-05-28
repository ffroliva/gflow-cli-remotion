# Capturing the promo master (terminal + browser generation)

How to capture the real footage that the Remotion compositions composite into
the promo. Findings verified 2026-05-28 against gflow-cli v0.9.1 on this
Windows host.

## The two browsers (don't confuse them)

| Role | Browser | Headed? | Touches Google? |
|------|---------|---------|-----------------|
| **Rendering the promo** (`render-matrix`) | Remotion's bundled Chromium | Headless — correct | No |
| **Generating the content** (`gflow image/video`) | gflow's `ui_automation` Chrome | **Headed / visible** | Yes — real Flow, spends credits |

`gflow`'s working generation path is `ui_automation`, which launches Chrome with
`headless=False` (`src/gflow_cli/api/transports/ui_automation.py`). **The Chrome
window is visible while it generates — so it can be screen-recorded.** (The
experimental HTTP transports run headless but currently 401 on the
`aisandbox-pa` generation endpoint; do not rely on them.)

## Auth (already working here)

gflow piggybacks on a real browser session. Existing live sessions on this host:
`denon82` (default), `ffroliva`, `default` — verify with:

```bash
gflow auth status --profile denon82   # cookies_present: True
```

To create/refresh a session, the documented bypass for Google's
"browser may not be secure" (G12) block is **Passive Capture**:

```bash
gflow auth login --browser chrome --profile <name>
```

`--browser chrome` launches your *real* installed Chrome with no automation
flags (no `navigator.webdriver`), you log in manually, and gflow extracts the
session. `auto`/`internal` use Playwright's Chromium, which Google rejects.

> The login itself is interactive — run it yourself (e.g. `! gflow auth login
> --browser chrome --profile promo-x`) so you can complete the Google sign-in.

## Capturing the screen

### Verified: ffmpeg gdigrab (no OBS needed)

`ffmpeg`'s `gdigrab` captures the live desktop from this environment (probed
2026-05-28: non-black frame, YAVG ≈ 52). Record while running a real gflow
generation:

```bash
# 1. start the screen recording (whole desktop)
ffmpeg -y -f gdigrab -framerate 30 -i desktop -pix_fmt yuv420p master-raw.mp4 &

# 2. run a real generation — opens the visible gflow Chrome + prints to terminal
gflow image t2i "a quiet mountain lake at dawn, cinematic" --aspect 16:9 --profile denon82

# 3. stop ffmpeg (q / kill) → master-raw.mp4 holds terminal + browser
```

Capture a single window instead of the whole desktop with
`-i title=<window title>` (e.g. the Chrome/Flow window, or the terminal).

### Alternative: OBS via `record-promo`

`scripts/record-promo.mts` drives OBS over websocket (start record → spawn gflow
phases → stop) and writes a Zod `run.json` beside `master.mp4`. Requires the
one-time OBS setup in [SETUP.md](SETUP.md) (websocket password + a scene that
composites the terminal pane + the Chrome window). Preferred once OBS is
configured, because the scene framing/cropping is reusable.

## The terminal half is rendered, not screen-grabbed

The terminal portion of the promo is produced by the **`Terminal` Remotion
composition** (`src/remotion/promo/Terminal.tsx`), driven by real captured gflow
output in `types/terminal-session.ts`. This is sharper, branded, and PII-free
versus a raw desktop grab. Capture fresh output with `gflow --help`,
`gflow image t2i --help`, `gflow data list images`, etc., redact
profiles/paths, and update the session file.

## Assembling the promo

1. **Browser footage** → screen-record a real `gflow` generation (above) → this
   becomes the `master.mp4` in the run dir.
2. **Terminal footage** → render the `Terminal` composition.
3. **Compose** → `render-matrix` layers hooks/branding over the master;
   `post-gif` makes the README GIF.

Output paths and the verification ledger are in [SETUP.md](SETUP.md).
