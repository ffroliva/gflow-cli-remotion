@echo off
type "%~dp0..\gflow-stdout\video.jsonl"
type nul > "%~1\fake-video.mp4"
exit /b 0
