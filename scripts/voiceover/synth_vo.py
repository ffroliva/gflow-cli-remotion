#!/usr/bin/env python3
"""Synthesize promo voiceover variants with Microsoft Edge TTS.

Reuses the Compiled Growth pipeline's edge-tts integration (voice catalog +
`en-US-AndrewNeural` @ -5% house style; see that repo's docs/audio/EDGE_TTS_GUIDE.md).
edge-tts is unofficial/free Azure neural TTS — no API key.

Run self-contained (no repo dep needed):
    uv run --with edge-tts python scripts/voiceover/synth_vo.py

Writes per variant to out/promo/voiceover/:
    <id>.mp3          the audio
    <id>.words.json   word-boundary timing (for Remotion <Audio> alignment)

Each variant's spoken duration is printed so scripts can be tuned to the
target video length (the prompt-first promos are ~15.08s).
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts  # type: ignore

_HERE = Path(__file__).parent.resolve()
_CONFIG = _HERE / "vo_scripts.json"
_OUT = _HERE.parent.parent / "out" / "promo" / "voiceover"


async def synth_one(text: str, voice: str, rate: str, mp3_path: Path) -> list[dict]:
    """Stream one variant to disk; return WordBoundary cues (seconds)."""
    words: list[dict] = []
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    with mp3_path.open("wb") as fh:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # Azure emits 100-ns ticks; convert to seconds.
                words.append(
                    {
                        "text": chunk["text"],
                        "start": round(chunk["offset"] / 1e7, 3),
                        "duration": round(chunk["duration"] / 1e7, 3),
                    },
                )
    return words


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=_CONFIG)
    parser.add_argument("--out", type=Path, default=_OUT)
    parser.add_argument(
        "--only",
        help="Synthesize only the variant with this id (default: all).",
    )
    args = parser.parse_args()

    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    rate = cfg.get("rate", "-5%")
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"=== synth_vo: {args.config.name} -> {args.out} (rate {rate}) ===")
    for variant in cfg["variants"]:
        vid = variant["id"]
        if args.only and vid != args.only:
            continue
        voice = variant["voice"]
        text = variant["text"]
        mp3_path = args.out / f"{vid}.mp3"
        words = await synth_one(text, voice, rate, mp3_path)

        spoken = round(words[-1]["start"] + words[-1]["duration"], 2) if words else 0.0
        wc = len(text.split())
        (args.out / f"{vid}.words.json").write_text(
            json.dumps({"voice": voice, "rate": rate, "text": text, "words": words}, indent=2),
            encoding="utf-8",
        )
        size_kb = mp3_path.stat().st_size // 1024
        print(f"[{vid:16}] {voice:22} {wc:2}w  ~{spoken:5.2f}s  {size_kb:4}KB  -> {mp3_path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
