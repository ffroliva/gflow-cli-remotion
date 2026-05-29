#!/usr/bin/env bash
# Stub stand-in for scripts/capture/flow_workflow.py --dry-run, used by the
# record-workflow integration test (no Python / no uv / no playwright install).
# Mirrors the sentinel contract from src/orchestrator/sentinels.ts.
set -eu
OUT="$1"
echo "[workflow] READY"
echo "[workflow] PHASE START t2i"
: > "${OUT}/01-t2i.png"
echo "[workflow] PHASE END t2i ${OUT}/01-t2i.png"
echo "[workflow] PHASE START i2i"
: > "${OUT}/02-i2i.png"
echo "[workflow] PHASE END i2i ${OUT}/02-i2i.png"
echo "[workflow] PHASE START video"
: > "${OUT}/03-video.mp4"
echo "[workflow] PHASE END video ${OUT}/03-video.mp4"
echo "[workflow] DONE"
