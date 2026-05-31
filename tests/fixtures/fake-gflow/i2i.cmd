@echo off
type "%~dp0..\gflow-stdout\i2i.jsonl"
type nul > "%~1\fake-i2i.png"
exit /b 0
