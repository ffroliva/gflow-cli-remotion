# Capturing the promo master (terminal + browser generation)

How to capture the real footage that the Remotion compositions composite into
the promo. Last verified 2026-05-31 against gflow-cli v0.11.0 on this
Windows host.

## Key fix in v0.11.0

`gflow video i2v` was silently routed to T2V in v0.10.x (issue #125), dropping
the start image and `--end-image` end frame entirely. **v0.11.0 fixes this.**
Always run `gflow --version` before a credit-spending pipeline run to confirm
you are on v0.11.0 or later:

```bash
gflow --version  # must be 0.11.0+
```

## The full pipeline: t2i → i2i → i2v with start + end frames

The `--pipeline` flag on `record-promo` runs the three-phase stickman showcase:

1. **t2i** — dark pre-dawn stickman image (start frame for i2v)
2. **i2i** — sunrise stickman image with `--ref <t2i-result>` (end frame for i2v)
3. **i2v** — `gflow video i2v <t2i.png> <motion> --end-image <i2i.png>` —
   Flow interpolates dark→bright with the motion prompt guiding the animation

```bash
pnpm record-promo --pipeline --profile promo-<name> --run-id $(date +%Y-%m-%d)-001
```

The orchestrator tracks `firstArtifact` (t2i output) separately from
`prevArtifact` (most recent image) so i2v always receives the correct start and
end frames. It aborts if either is missing or they are the same file.

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

### OBS via `record-promo` (the capture method)

`scripts/record-promo.mts` drives OBS over its websocket: it builds a clean
capture scene, starts recording, spawns the gflow generation phases, stops, and
writes a Zod `run.json` beside `master.mp4`.

**Why OBS, not a desktop grab.** OBS captures a single *window* — only the Flow
Chrome window's pixels, even when it is occluded or unfocused. The rest of the
desktop, the taskbar, and any other windows you have open never enter the frame.
`prepareBrowserScene` (in `src/orchestrator/obs.ts`) sets this up automatically
on every run:

- creates/selects a `promo-browser` scene with one `window_capture` source using
  **Windows Graphics Capture** (the method that captures GPU-accelerated Chrome;
  BitBlt renders Chrome black);
- **resolves the live Flow window at record time** — matches `chrome.exe` plus a
  title containing `Flow` (see `src/orchestrator/window-match.ts`). A browser
  title drifts as the page changes, so a frozen window string goes stale and OBS
  records black; resolving live avoids that;
- sets the master canvas to 1920×1080 and fits the window into it;
- optional crop to strip the browser chrome / the "unsupported flag" banner.

If no matching window is open, `record-promo` aborts rather than capture the
wrong window.

**Operator prerequisites:**
1. OBS running with **obs-websocket enabled** (Tools → WebSocket Server Settings;
   default port 4455). One-time details in [SETUP.md](SETUP.md).
2. The websocket **password** in `OBS_WS_PASSWORD`, a live gflow session, and the
   Flow Chrome window open, then record.

**OBS_WS_PASSWORD — where it comes from (two-sided):**
- *Server side (in OBS):* the password lives in OBS → Tools → WebSocket Server
  Settings. OBS persists it to
  `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`
  (`server_enabled`, `server_port`, `auth_required`, `server_password`). If
  WebSocket is already enabled there, **nothing needs creating server-side** —
  just mirror the value.
- *Client side (this repo):* `record-promo.mts` calls `import "dotenv/config"`,
  so it auto-loads a gitignored **`.env`** at the repo root. Put the password
  there once for systemic reuse — no per-shell `export` needed:

  ```dotenv
  # .env (gitignored via .gitignore: `.env`)
  OBS_WS_PASSWORD=<value from OBS WebSocket Server Settings>
  ```

  To (re)sync `.env` from OBS's own config and verify it connects:

  ```bash
  node -e '(async()=>{const fs=require("fs");const c=JSON.parse(fs.readFileSync(process.env.APPDATA+"/obs-studio/plugin_config/obs-websocket/config.json","utf8"));let e="";try{e=fs.readFileSync(".env","utf8")}catch{}e=/^OBS_WS_PASSWORD=/m.test(e)?e.replace(/^OBS_WS_PASSWORD=.*$/m,"OBS_WS_PASSWORD="+c.server_password):e+"\nOBS_WS_PASSWORD="+c.server_password+"\n";fs.writeFileSync(".env",e);const{default:O}=await import("obs-websocket-js");const o=new O();await o.connect("ws://127.0.0.1:"+c.server_port,c.server_password,{rpcVersion:1});console.log("OBS connect OK");await o.disconnect();})()'
  ```

  If you change the password in the OBS GUI, re-run the snippet above to re-sync
  `.env`. `scrubEnv` drops `OBS_WS_PASSWORD` from the gflow child env (it matches
  the `^OBS_WS` forbidden pattern), so it never leaks into the recorded session.

```bash
# password is auto-loaded from .env — no export needed
pnpm record-promo --profile promo-<name> --run-id $(date +%Y-%m-%d)-001
```

### Deprecated: full-desktop `ffmpeg gdigrab` — DO NOT USE

An earlier approach recorded the whole desktop with
`ffmpeg -f gdigrab -i desktop`. **This is what produced the polluted masters**
(confirmed by frame inspection 2026-05-28): grabbing every pixel on screen
captured concurrent dev work, the Windows taskbar, the browser chrome, and the
OS locale — not a usable promo asset. Use the OBS window-capture path above.
(A `gdigrab` of a *single* window via `-i title=<window>` avoids the desktop
leak but is still fragile — title drift, no occlusion handling, manual stop —
versus OBS window-capture.)

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
