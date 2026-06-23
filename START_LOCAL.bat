@echo off
cd /d "%~dp0"
echo Starting Amethyst AI on http://localhost:5173
echo Keep this window open while you use the local site.
npm.cmd run dev -- --host 0.0.0.0 --port 5173
pause
