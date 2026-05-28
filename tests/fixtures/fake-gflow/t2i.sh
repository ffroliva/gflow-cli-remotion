#!/bin/sh
cat "$(dirname "$0")/../gflow-stdout/t2i.jsonl"
touch "$1/fake-t2i.png"
exit 0
