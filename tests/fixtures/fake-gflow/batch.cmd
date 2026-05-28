@echo off
type "%~dp0..\gflow-stdout\batch.jsonl"
type nul > "%~1\fake-batch-1.png"
type nul > "%~1\fake-batch-2.png"
type nul > "%~1\fake-batch-3.png"
exit /b 0
