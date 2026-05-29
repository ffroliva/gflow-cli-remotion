#!/usr/bin/env python3
"""Open a long-lived Flow Chrome window and idle.

Phase-1 verification harness for the in-process workflow capture: launches a
Playwright persistent context against a promo profile, navigates to Flow's
editor, then idles until a duration expires (or SIGINT). This deliberately
mirrors gflow's `UiAutomationTransport.setup()` Chrome args so the live Flow
window OBS captures here is materially identical to the one the real
workflow run will produce — but spends ZERO Flow credits (no generation).

Why this exists separately from gflow's CLI: gflow generation commands run as
subprocesses that close their browser at teardown, so OBS only sees an
ephemeral window per command. The real workflow promo needs ONE continuous
window across t2i -> i2i -> i2v; this script proves that "one persistent
context lives long enough for OBS to bind, record, and stop cleanly" before
spending credits on the paid run.

Run via uv (self-contained, no repo Python dep):
    uv run --with playwright python scripts/capture/flow_idle.py \\
        --profile promo-denon82 --seconds 30
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import signal
import sys
from pathlib import Path
from typing import cast

from playwright.async_api import ViewportSize, async_playwright

# Profile name must match `promo-<alnum/dash/underscore>`. The `promo-` prefix
# is the orchestrator convention; the strict character class blocks shell
# metacharacters AND path-traversal sequences (`..`, `/`, `\`) before the
# name is joined onto the platformdirs root. record-idle.mts applies the
# same regex on its side; both layers defend in depth.
_PROFILE_NAME_RE = re.compile(r"^promo-[A-Za-z0-9_-]+$")

# Flow's editor landing URL. The persistent profile carries the auth cookies
# from a prior `gflow auth login --browser chrome`, so this lands on the
# logged-in editor and the page title becomes "...Flow..." for the OBS
# window-match (the `\bFlow\b` word-boundary in window-match.ts).
FLOW_URL = "https://labs.google/fx/tools/flow/"

# Mirror UiAutomationTransport._VIEWPORT semantics: 1920x1080 fits the 16:9
# OBS canvas the orchestrator sets. record-promo's prepareBrowserScene
# fits-into-canvas via OBS_BOUNDS_SCALE_INNER, so a slight viewport mismatch
# is letterboxed cleanly.
_VIEWPORT = {"width": 1920, "height": 1080}


def resolve_profile_dir(profile_name: str) -> Path:
    """Mirror gflow-cli's platformdirs layout (user_data_dir('gflow-cli','ffroliva'))
    exactly. Verified against the gflow auth module 2026-05-28.
    """
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA")
        if not base:
            sys.exit("LOCALAPPDATA missing on Windows host")
        root = Path(base) / "ffroliva" / "gflow-cli"
    elif sys.platform == "darwin":
        home = os.environ.get("HOME")
        if not home:
            sys.exit("HOME missing")
        root = Path(home) / "Library" / "Application Support" / "gflow-cli"
    else:
        home = os.environ.get("HOME")
        if not home:
            sys.exit("HOME missing")
        root = Path(home) / ".local" / "share" / "gflow-cli"
    return root / f"profile_{profile_name}"


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        required=True,
        help="Promo profile name (must start with 'promo-' per orchestrator convention).",
    )
    parser.add_argument(
        "--seconds",
        type=int,
        default=30,
        help="Idle duration in seconds. Use 0 for indefinite (until SIGINT).",
    )
    parser.add_argument(
        "--url",
        default=FLOW_URL,
        help=f"Override the landing URL (default: {FLOW_URL}).",
    )
    args = parser.parse_args()

    if not _PROFILE_NAME_RE.match(args.profile):
        sys.exit(
            f"--profile '{args.profile}' must match {_PROFILE_NAME_RE.pattern} "
            "(promo-<alnum/dash/underscore>, no shell metacharacters or path separators)",
        )

    profile_dir = resolve_profile_dir(args.profile)
    if not profile_dir.exists():
        sys.exit(f"profile dir not found: {profile_dir}")

    # Honour a SIGINT cleanly so the persistent context closes on Ctrl+C and
    # the profile lockfile is released for the next run.
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    try:
        loop.add_signal_handler(signal.SIGINT, stop.set)
    except NotImplementedError:
        # Windows: add_signal_handler is unsupported; rely on KeyboardInterrupt.
        pass

    print(f"[flow_idle] profile_dir={profile_dir}", flush=True)
    print(f"[flow_idle] url={args.url}", flush=True)
    print(f"[flow_idle] idle_seconds={args.seconds if args.seconds > 0 else 'indefinite'}", flush=True)

    async with async_playwright() as pw:
        # Args + add_init_script mirror UiAutomationTransport.setup(). Hiding
        # navigator.webdriver matters because reCAPTCHA Enterprise scores a
        # WebDriver session as a bot and Flow can serve a 403 / locked UI.
        ctx = await pw.chromium.launch_persistent_context(
            str(profile_dir),
            headless=False,
            viewport=cast(ViewportSize, _VIEWPORT),
            locale=os.environ.get("GFLOW_CLI_LOCALE", "en-US"),
            channel="chrome",  # installed Chrome, not Playwright's chromium
            args=[
                "--disable-blink-features=AutomationControlled",
                "--password-store=basic",
                "--lang=en-US",
            ],
        )
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})",
        )
        try:
            page = ctx.pages[0] if ctx.pages else await ctx.new_page()
            try:
                await page.goto(args.url, wait_until="networkidle", timeout=45_000)
            except Exception as e:  # noqa: BLE001 - log + continue idling
                print(f"[flow_idle] WARN goto failed: {e}", flush=True)
            print(f"[flow_idle] window READY  title={await page.title()!r}", flush=True)

            if args.seconds > 0:
                try:
                    await asyncio.wait_for(stop.wait(), timeout=args.seconds)
                    print("[flow_idle] SIGINT received; closing early", flush=True)
                except asyncio.TimeoutError:
                    print(f"[flow_idle] idle window of {args.seconds}s elapsed", flush=True)
            else:
                await stop.wait()
                print("[flow_idle] SIGINT received; closing", flush=True)
        finally:
            await ctx.close()
            print("[flow_idle] context closed", flush=True)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("[flow_idle] KeyboardInterrupt; closing", flush=True)
        raise SystemExit(130) from None
