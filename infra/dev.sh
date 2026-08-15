#!/usr/bin/env bash
set -euo pipefail
echo App  http://127.0.0.1:5173
echo API  http://127.0.0.1:8000
if ss -ltn 2>/dev/null | grep -q ":5173 "; then echo Vite is up; else echo Vite is down; fi
if ss -ltn 2>/dev/null | grep -q ":8000 "; then echo API is up; else echo API is down; fi
