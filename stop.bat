@echo off
REM ============================================================
REM  POS System - STOP / TURN OFF
REM  Stops the backend + Caddy proxy processes managed by PM2.
REM ============================================================

setlocal
cd /d "%~dp0"

echo ============================================
echo   Stopping POS System
echo ============================================
echo.

REM --- locate pm2 (a double-clicked .bat can have a limited PATH) ---
where pm2 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pm2 is not on PATH in this window.
  echo         Open a normal terminal and run:  pm2 stop all
  echo.
  pause
  exit /b 1
)

echo Using pm2 from:
where pm2
echo.

echo --- Processes BEFORE stop ---
call pm2 list
echo.

echo Stopping all PM2 apps (pos-backend, pos-proxy, ...)...
call pm2 stop all
echo.

echo --- Processes AFTER stop ---
call pm2 list
echo.

echo ============================================
echo  Done.
echo.
echo  If anything above is still "online", PM2 was started under a
echo  DIFFERENT Windows account or elevation than this window. Run
echo  stop.bat from the SAME account/elevation you used for start.bat
echo  (e.g. both as Administrator, or both normal).
echo.
echo  To fully shut PM2 down (frees port 80):   pm2 kill
echo  To bring everything back up:               start.bat
echo ============================================
echo.
pause
endlocal
