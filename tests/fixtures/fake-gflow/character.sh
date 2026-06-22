#!/bin/sh
cat "$(dirname "$0")/../gflow-stdout/character.jsonl"
touch "$1/fake-character-face.jpg" "$1/fake-character-body.png"
exit 0
