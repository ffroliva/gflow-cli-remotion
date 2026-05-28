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
2026-05-28: non-black frame, YAVG ≈ 52; a clean run produced a 48s tail-free
1920×1200 master). **Run the whole sequence synchronously in one shell** so the
stop runs in the same session as the recorder:

```bash
OUT=~/gflow-output/promo/<run-id>; mkdir -p "$OUT"
# 1. start recording to .mkv (truncation-safe) in the background
ffmpeg -y -f gdigrab -framerate 30 -i desktop -pix_fmt yuv420p "$OUT/capture.mkv" &
sleep 2
# 2. run a real generation — opens the visible gflow Chrome (ui_automation).
#    Isolated DB avoids the exit-16 schema-drift trap (see below).
GFLOW_CLI_DB_PATH="$OUT/catalog.db" \
  gflow image t2i "a serene mountain lake at dawn, cinematic" \
  --aspect 16:9 --profile denon82 --out "$OUT"
# 3. STOP: taskkill works in-session; a SIGINT/`kill` from a detached
#    (nohup'd) git-bash script does NOT stop Windows ffmpeg → runaway
#    recording. So never background this whole sequence.
taskkill //F //IM ffmpeg.exe
# 4. remux the crash-safe .mkv to a finalized .mp4
ffmpeg -y -i "$OUT/capture.mkv" -c copy "$OUT/master.mp4"
```

**Pitfall (learned 2026-05-28):** backgrounding the orchestration with `nohup`
left the recorder unkillable (SIGINT ignored by Windows ffmpeg, cross-session
`taskkill` unreliable) and it recorded 3.5 min of idle desktop. Foreground +
`taskkill` = a clean ~48s master.

Capture a single window instead of the whole desktop with
`-i title=<window title>` (e.g. the Chrome/Flow window). Trim precisely later
using the `prompt_submitted` → `batch_response_captured` timestamps in gflow's
JSONL.

### Alternative: OBS via `record-promo`

`scripts/record-promo.mts` drives OBS over websocket (start record → spawn gflow
phases → stop) and writes a Zod `run.json` beside `master.mp4`. Requires the
one-time OBS setup in [SETUP.md](SETUP.md) (websocket password + a scene that
composites the terminal pane + the Chrome window). Preferred once OBS is
configured, because the scene framing/cropping is reusable.

## Database isolation (avoids the exit-16 schema-drift trap)

**Problem.** gflow opens its SQLite catalog and applies pending migrations
*before* any Flow call. If the catalog DB was written by a **newer** gflow
(e.g. an under-development branch at schema 2) than the `gflow` binary on PATH
(e.g. released v0.9.1 at schema 1), the older binary refuses to touch it and
exits **16** with `DataMigrationError: database schema N is newer than
installed schema M`. No credits are spent — but it kills a recording before it
starts. (Full mechanics: gflow-cli `docs/DATA_LAYER.md`; reaction guide:
gflow-cli `docs/KNOWN_ISSUES.md`.)

**Alternatives considered.**
1. *Upgrade gflow* so the binary matches the DB schema — fixes it until the
   next drift; relies on the operator keeping versions in sync.
2. *Preflight version/schema check* in `record-promo` — fails fast with a clear
   message but still requires a fix before recording.
3. *Separate per-run DB* — the promo never touches the main catalog. **Chosen.**

**What we do.** `record-promo` injects `GFLOW_CLI_DB_PATH=<run-dir>/catalog.db`
into the gflow child process. A fresh per-run DB always matches whatever gflow
binary runs, so drift can never fail a recording, and the operator's real
catalog is never polluted by throwaway promo generations. `scrubEnv` strips any
inherited `GFLOW_CLI_DB_PATH` first, so this is deterministic regardless of the
operator's environment.

> If you run gflow manually for a capture (outside `record-promo`), pass the
> same override yourself:
> `GFLOW_CLI_DB_PATH=<somewhere>/promo.db gflow image t2i "…" --profile <p>`.

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
