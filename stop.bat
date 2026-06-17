@echo off
REM ============================================================
REM  POS System - STOP / TURN OFF
REM  Stops the backend + Caddy proxy processes managed by PM2.
REM  They stay in PM2's list, so start.bat brings them back.
REM ============================================================

setlocal
cd /d "%~dp0"

echo ============================================
echo   Stopping POS System
echo ============================================
echo.

where pm2 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pm2 was not found on PATH - nothing to stop.
  echo         (If the server is running some other way, close that window.)
  echo.
  pause
  exit /b 1
)

echo Stopping backend + proxy...
call pm2 stop pos-backend pos-proxy

echo.
echo Current status:
call pm2 status

echo.
echo ============================================
echo  POS System stopped.
echo  - Run start.bat to bring it back up.
echo  - To remove them from PM2 entirely:  pm2 delete all
echo ============================================
echo.
pause
endlocal
