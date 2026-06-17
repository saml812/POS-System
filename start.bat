@echo off
REM ============================================================
REM  Starts the POS System in PRODUCTION
REM  Brings up the backend + Caddy reverse proxy via PM2.
REM ============================================================

setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================
echo   Starting POS System (production)
echo ============================================
echo.

REM --- make sure PM2 is available ---
where pm2 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pm2 was not found on PATH.
  echo         Install it once with:
  echo             npm install -g pm2 pm2-windows-startup
  echo.
  pause
  exit /b 1
)

REM --- start (or reload if already running) both processes ---
echo Launching backend + proxy via PM2...
call pm2 startOrReload deploy\ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo.
  echo [ERROR] PM2 failed to start the apps. See the messages above.
  echo.
  pause
  exit /b 1
)

REM --- remember the process list so it survives reboots ---
call pm2 save

echo.
echo Current status:
call pm2 status

echo.
echo ============================================
echo  POS is running.
echo  Terminals browse to:  http://^<this-server-IP^>
echo  (find the IP with 'ipconfig')
echo.
echo  Useful: pm2 logs   pm2 status   pm2 stop all
echo ============================================
echo.
pause
endlocal
