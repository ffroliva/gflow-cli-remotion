#!/usr/bin/env python3
# Pyright cannot resolve gflow_cli in this repo's analysis env (the package
# lives in the uv-managed runtime, not in node_modules / pyproject deps), so
# call-shape checks on FlowApiClient / GenerateImageRequest / etc. surface as
# false positives. The script is exercised end-to-end against the real
# installed package at runtime; mis-shaped calls fail loudly there.
# pyright: reportCallIssue=false
"""In-process stickman workflow capture driver: t2i -> i2i -> i2v.

The Phase-2 verification (`flow_idle.py`) proved that OBS can bind to a
chrome.exe "Flow" window for the duration of a Playwright persistent
context. This script does the same — but inside that ONE context, runs
the full creative chain via gflow_cli's `FlowApiClient`:

    1. create_project(title="gflow stickman workflow")
    2. generate_image(t2i)              -> outRoot/01-t2i.png
    3. generate_image(i2i, ref=t2i)     -> outRoot/02-i2i.png
    4. generate_video(i2v, start=t2i,   -> outRoot/03-video.mp4
                       end=i2i, motion)

Because all four steps share one `async with FlowApiClient(...)` block,
there is ONE persistent context, ONE Chrome window, and OBS films the
whole chain end-to-end. (The Phase-2 council audit ruled out co-running
a second persistent context on the same profile — Chromium SingletonLock
would fail. So this script REPLACES flow_idle.py for the workflow run.)

Stdout sentinels for the TS harness — keep in sync with
`src/orchestrator/sentinels.ts`:

    [workflow] READY                          (recording can start)
    [workflow] PHASE START <t2i|i2i|video>    (phase n begins)
    [workflow] PHASE END   <kind> <abs-path>  (phase n done, artifact written)
    [workflow] DONE                           (recording can stop)

Run via uv with gflow-cli as an ephemeral dependency:

    uv run --with gflow-cli==0.10.0 python scripts/capture/flow_workflow.py \\
        --profile promo-denon82 --out-root <abs/path>
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import signal
import sys
import time
from pathlib import Path

# Profile name must match `promo-<alnum/dash/underscore>` — blocks shell
# metacharacters and path-traversal sequences before they flow into a
# platformdirs-rooted profile_dir join. Same regex as
# `scripts/record-workflow.mts` PROFILE_NAME_RE.
_PROFILE_NAME_RE = re.compile(r"^promo-[A-Za-z0-9_-]+$")

# Stickman subject + style — promotes the "Compiled Growth / 5 AM club"
# narrative chosen 2026-05-29 (see memory `gflow-showcase-stickman-concept`).
_STICKMAN_T2I = (
    "A bold minimalist motivational stickman character, recurring mascot for "
    "a channel called Compiled Growth, waking at 5 AM before sunrise in a "
    "quiet city apartment. Simple black ink line body with expressive "
    "posture, round head, tiny determined eyes, subtle warm gold rim light, "
    "desk lamp, open notebook, coffee steam, window showing a dark blue "
    "pre-dawn city. Cinematic vertical poster frame, clean high contrast, "
    "inspiring and mature, not childish, no text, no logos, no watermark."
)
_STICKMAN_I2I = (
    "Same minimalist black ink stickman and apartment, now standing and "
    "stretching with quiet determination as golden sunrise light floods "
    "through the window. Warmer, brighter, more triumphant; same clean "
    "high-contrast vertical poster style. No text, no logos, no watermark."
)
_STICKMAN_MOTION = (
    "The stickman rises and stretches with quiet determination, coffee steam "
    "drifting, the golden sunrise glow slowly strengthening through the "
    "window; gentle cinematic push-in, subtle, premium."
)


def _emit(line: str) -> None:
    """Stdout sentinel emitter — flushed so the TS harness parser sees it
    promptly even when stdout is pipe-buffered."""
    print(line, flush=True)


def _resolve_profile_dir(profile_name: str) -> Path:
    """Mirror gflow-cli's `platformdirs.user_data_dir('gflow-cli','ffroliva')`."""
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


def _install_sigint_handler() -> asyncio.Event:
    """Register a SIGINT handler that flips an asyncio.Event. Callers check the
    event between phases so a Ctrl+C between paid operations triggers a clean
    `async with FlowApiClient(...)` teardown rather than a raw KeyboardInterrupt
    that may land mid-Playwright-call and skip the persistent-context close
    (which would leak Chrome and lock the profile)."""
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _flip() -> None:
        if not stop.is_set():
            _emit("[workflow] INTERRUPTED")
        stop.set()

    try:
        loop.add_signal_handler(signal.SIGINT, _flip)
    except NotImplementedError:
        # Windows: add_signal_handler is unsupported on ProactorEventLoop.
        # KeyboardInterrupt from asyncio.run will still trip the outer
        # try/except in __main__; the between-phase check just won't catch it.
        pass
    return stop


async def _run_workflow(
    profile_dir: Path,
    out_root: Path,
    *,
    aspect_str: str,
    image_model_str: str,
    video_model_str: str,
) -> int:
    """The real (credit-spending) workflow. Import gflow_cli lazily so the
    `--help` path stays fast and import errors land at the runtime callsite."""
    from gflow_cli.api.client import FlowApiClient  # noqa: PLC0415
    from gflow_cli.api.image import (  # noqa: PLC0415
        Aspect as ImageAspect,
        GenerateImageRequest,
        Model,
    )
    from gflow_cli.api.video import (  # noqa: PLC0415
        Aspect as VideoAspect,
        GenerateVideoRequest,
        Mode,
        VideoModel,
    )

    # Each enum's bare constructor takes the WIRE-format value
    # (`IMAGE_ASPECT_RATIO_PORTRAIT`, `nano2`, ...). `from_cli` maps the
    # CLI-friendly strings ("9:16", "nano-pro", "omni-flash") the operator
    # actually types — same translation the gflow CLI itself does.
    image_aspect = ImageAspect.from_cli(aspect_str)
    video_aspect = VideoAspect.from_cli(aspect_str)
    image_model = Model.from_cli(image_model_str)
    video_model = VideoModel.from_cli(video_model_str)

    t0 = time.monotonic()
    phase_times: list[dict[str, float | str]] = []

    def _phase_start(kind: str) -> float:
        ts = time.monotonic() - t0
        _emit(f"[workflow] PHASE START {kind}")
        return ts

    def _phase_end(kind: str, started: float, artifact: Path) -> None:
        ended = time.monotonic() - t0
        phase_times.append(
            {"kind": kind, "started_ms": started * 1000, "ended_ms": ended * 1000, "artifact": str(artifact)},
        )
        _emit(f"[workflow] PHASE END {kind} {artifact}")

    stop = _install_sigint_handler()
    # out_dir=out_root: route every download through outRoot directly so we
    # don't need cross-drive shutil.move at the end (council Phase-3 #4 — an
    # antivirus hold mid-move can leave both src and dst, and the cross-drive
    # path is slower).
    async with FlowApiClient(
        profile_dir=profile_dir, transport="ui_automation", out_dir=out_root,
    ) as client:
        # Wait until the Flow editor page is actually titled ".../Flow"
        # before signalling READY — OBS's prepareBrowserScene matches on the
        # word "Flow" in chrome.exe window titles via window-match.ts. A
        # premature READY would race the title transition and bind to the
        # wrong (still-blank-tab) window or fail to match at all.
        # client._page is the page FlowApiClient.__aenter__ created.
        if client._page is not None:
            try:
                await client._page.wait_for_function(
                    "document.title.includes('Flow')",
                    timeout=15_000,
                )
            except Exception as e:  # noqa: BLE001 - non-fatal; READY follows
                print(f"[workflow] WARN title-wait failed: {e}", flush=True)
        _emit("[workflow] READY")

        project = await client.create_project(title="gflow stickman workflow")

        # Phase 1 — t2i
        started = _phase_start("t2i")
        t2i_req = GenerateImageRequest(
            prompt=_STICKMAN_T2I, aspect=image_aspect, model=image_model, count=1,
        )
        t2i_img = await client.generate_image(project_id=project.project_id, req=t2i_req)
        # download_image RETURNS the actual saved path — gflow's
        # `paths.correct_image_extension()` sniffs magic bytes and renames
        # the file post-write if Flow served a different format than the
        # extension we requested (e.g. JPEG served at a `.png` target →
        # actual file lands as `.jpg`). The i2i ref_paths attach + i2v
        # start_image then need the REAL path, not what we asked for.
        t2i_path = await client.download_image(t2i_img, out_root / "01-t2i.png")
        _phase_end("t2i", started, t2i_path)
        if stop.is_set():
            raise asyncio.CancelledError("workflow stopped after t2i by SIGINT")

        # Phase 2 — i2i (use t2i image as ref via ref_paths; the editor-media
        # dialog path the ui_automation transport supports for I2I).
        started = _phase_start("i2i")
        i2i_req = GenerateImageRequest(
            prompt=_STICKMAN_I2I,
            aspect=image_aspect,
            model=image_model,
            ref_paths=(t2i_path,),  # pyright: ignore[reportCallIssue]
            count=1,
        )
        i2i_img = await client.generate_image(project_id=project.project_id, req=i2i_req)
        # Use the actual saved path — see t2i above for the magic-byte rename.
        i2i_path = await client.download_image(i2i_img, out_root / "02-i2i.png")
        _phase_end("i2i", started, i2i_path)
        if stop.is_set():
            raise asyncio.CancelledError("workflow stopped after i2i by SIGINT")

        # Phase 3 — i2v with both initial frame (t2i) AND end frame (i2i).
        # generate_video auto-downloads; VideoResult.local_path is the final
        # path. Rename into outRoot so the manifest claim matches.
        started = _phase_start("video")
        i2v_req = GenerateVideoRequest(
            prompt=_STICKMAN_MOTION,
            mode=Mode.I2V,
            aspect=video_aspect,
            model=video_model,
            start_image=t2i_path,
            end_image=i2i_path,
            count=1,
        )
        # generate_video does NOT accept project_id (unlike generate_image) —
        # it derives project context from the transport's current session.
        # Empirically confirmed by wf-003 traceback: "got an unexpected
        # keyword argument 'project_id'".
        video_result = await client.generate_video(req=i2v_req)
        video_target = out_root / "03-video.mp4"
        if video_result.local_path and Path(video_result.local_path) != video_target:
            shutil.move(str(video_result.local_path), str(video_target))
        _phase_end("video", started, video_target)

        _emit("[workflow] DONE")

    # Sidecar manifest the harness can splice into run.json.
    (out_root / "phases.json").write_text(
        json.dumps({"phases": phase_times}, indent=2),
        encoding="utf-8",
    )
    return 0


async def _run_dry(
    profile_dir: Path,
    out_root: Path,
    *,
    aspect_str: str,
    image_model_str: str,
    video_model_str: str,
) -> int:
    """Dry-run: write three placeholder artifacts and emit the same sentinels
    on a fast cadence. NO Flow API calls, NO browser, NO credits — used by
    integration tests of the TS harness contract."""
    del profile_dir, aspect_str, image_model_str, video_model_str  # unused

    t0 = time.monotonic()
    _emit("[workflow] READY")
    phase_times: list[dict[str, float | str]] = []

    async def _phase(kind: str, ext: str) -> None:
        started = time.monotonic() - t0
        _emit(f"[workflow] PHASE START {kind}")
        # Tiny sleep so the harness gets distinct timestamps per phase.
        await asyncio.sleep(0.05)
        artifact = out_root / f"{({'t2i': '01', 'i2i': '02', 'video': '03'})[kind]}-{kind}.{ext}"
        artifact.write_bytes(b"")  # placeholder; the harness only checks paths
        ended = time.monotonic() - t0
        phase_times.append(
            {"kind": kind, "started_ms": started * 1000, "ended_ms": ended * 1000, "artifact": str(artifact)},
        )
        _emit(f"[workflow] PHASE END {kind} {artifact}")

    await _phase("t2i", "png")
    await _phase("i2i", "png")
    await _phase("video", "mp4")

    _emit("[workflow] DONE")
    (out_root / "phases.json").write_text(
        json.dumps({"phases": phase_times}, indent=2),
        encoding="utf-8",
    )
    return 0


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        required=True,
        help="Promo profile name (must match ^promo-[A-Za-z0-9_-]+$).",
    )
    parser.add_argument("--out-root", required=True, type=Path, help="Directory for outputs.")
    parser.add_argument(
        "--aspect",
        default="9:16",
        help="Aspect ratio (default 9:16 for social vertical).",
    )
    parser.add_argument(
        "--image-model",
        default="nano-pro",
        help="Image model alias (default nano-pro; same Choice the CLI accepts).",
    )
    parser.add_argument(
        "--video-model",
        default="omni-flash",
        help="Video model alias (default omni-flash, supports 10s + end-frame).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip FlowApiClient + browser; emit sentinels for harness testing only.",
    )
    args = parser.parse_args()

    if not _PROFILE_NAME_RE.match(args.profile):
        sys.exit(
            f"--profile '{args.profile}' must match {_PROFILE_NAME_RE.pattern}",
        )
    args.out_root.mkdir(parents=True, exist_ok=True)
    # Skip profile-dir resolution in dry-run so CI containers without HOME /
    # LOCALAPPDATA can still exercise the harness contract end-to-end.
    if args.dry_run:
        profile_dir = Path("(unused-in-dry-run)")
    else:
        profile_dir = _resolve_profile_dir(args.profile)
        if not profile_dir.exists():
            sys.exit(f"profile dir not found: {profile_dir}")

    runner = _run_dry if args.dry_run else _run_workflow
    return await runner(
        profile_dir,
        args.out_root,
        aspect_str=args.aspect,
        image_model_str=args.image_model,
        video_model_str=args.video_model,
    )


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        _emit("[workflow] INTERRUPTED")
        raise SystemExit(130) from None
