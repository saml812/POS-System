@echo off
REM Launches the POS System backend and frontend dev servers in separate windows.

setlocal
set "ROOT=%~dp0"

echo Starting backend (http://localhost:3000)...
start "POS Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"

echo Starting frontend (http://localhost:5173)...
start "POS Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo Both servers are launching in separate windows.
echo Close those windows to stop the servers.
endlocal
