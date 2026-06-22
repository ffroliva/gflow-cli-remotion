@echo off
type "%~dp0..\gflow-stdout\character.jsonl"
type nul > "%~1\fake-character-face.jpg"
type nul > "%~1\fake-character-body.png"
exit /b 0
