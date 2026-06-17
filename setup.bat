@echo off
REM ============================================================
REM  POS System - FIRST-TIME SETUP
REM  Installs dependencies, prepares the database, and builds the frontend
REM  Run this once on a new server PC (and again after pulling new code). 
REM  Then use start.bat to run it.
REM ============================================================

setlocal enabledelayedexpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================
echo   POS System setup
echo ============================================
echo.

REM --- check Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install the LTS from https://nodejs.org and re-run this.
  echo.
  pause
  exit /b 1
)

REM --- make sure the backend has an .env to read ---
if not exist "%ROOT%backend\.env" (
  echo [SETUP] backend\.env not found - creating one from .env.example.
  copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
  echo.
  echo  ^>^> Edit backend\.env now ^(DATABASE_URL, SESSION_SECRET, CLIENT_URL^)
  echo     then run setup.bat again.
  echo.
  pause
  exit /b 1
)

REM --- global tooling (PM2 + Windows boot helper) ---
echo Installing PM2 (global)...
call npm install -g pm2 pm2-windows-startup
if errorlevel 1 (
  echo [WARN] Global PM2 install failed. If PM2 is already installed you can ignore this.
  echo        Otherwise re-run this window as Administrator.
)

REM --- backend dependencies + database ---
echo.
echo === Backend ===
cd /d "%ROOT%backend"

echo Installing backend dependencies...
call npm install
if errorlevel 1 ( echo [ERROR] backend npm install failed. & pause & exit /b 1 )

echo Generating Prisma client...
call npm run db:generate
if errorlevel 1 ( echo [ERROR] prisma generate failed. & pause & exit /b 1 )

echo Applying database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo [ERROR] Database migration failed.
  echo        Check DATABASE_URL in backend\.env and that PostgreSQL is running.
  pause
  exit /b 1
)

set /p SEED="Seed demo data (users + menu)? [y/N] "
if /i "!SEED!"=="y" (
  echo Seeding...
  call npm run db:seed
)

REM --- frontend dependencies + production build ---
echo.
echo === Frontend ===
cd /d "%ROOT%frontend"

echo Installing frontend dependencies...
call npm install
if errorlevel 1 ( echo [ERROR] frontend npm install failed. & pause & exit /b 1 )

echo Building frontend (production)...
call npm run build
if errorlevel 1 ( echo [ERROR] frontend build failed. & pause & exit /b 1 )

cd /d "%ROOT%"
echo.
echo ============================================
echo  Setup complete.
echo  Next: run start.bat to launch the server,
echo  then (once) run:  pm2-startup install
echo  so it comes back after a reboot.
echo ============================================
echo.
pause
endlocal
