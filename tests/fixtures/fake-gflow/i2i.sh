#!/usr/bin/env bash
cat "$(dirname "$0")/../gflow-stdout/i2i.jsonl"
touch "$1/fake-i2i.png"
exit 0
