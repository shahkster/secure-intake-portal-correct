@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org
  pause
  exit /b 1
)
call npm install
if not exist .env.local call npm run setup
call npx vercel dev
pause
