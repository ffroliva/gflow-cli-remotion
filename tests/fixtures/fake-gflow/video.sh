#!/bin/sh
cat "$(dirname "$0")/../gflow-stdout/video.jsonl"
touch "$1/fake-video.mp4"
exit 0
