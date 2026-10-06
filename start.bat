@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [Interview Platform] Node.js is not installed or not on PATH.
  echo Install Node.js 22+ and try again.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [Interview Platform] pnpm is not installed or not on PATH.
  echo Enable Corepack with: corepack enable
  pause
  exit /b 1
)

echo.
echo Starting Interview Platform...
echo Keep this window open while developing.
echo.
call pnpm start:all
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Interview Platform stopped with error code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
