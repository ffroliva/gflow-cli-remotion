@echo off
type "%~dp0..\gflow-stdout\t2i.jsonl"
type nul > "%~1\fake-t2i.png"
exit /b 0
