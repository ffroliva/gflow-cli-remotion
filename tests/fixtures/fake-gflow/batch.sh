#!/bin/sh
cat "$(dirname "$0")/../gflow-stdout/batch.jsonl"
touch "$1/fake-batch-1.png" "$1/fake-batch-2.png" "$1/fake-batch-3.png"
exit 0
