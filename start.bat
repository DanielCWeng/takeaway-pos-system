@echo off
setlocal

rem Start the takeaway POS development services from the repository root.
rem The Node server launches TapiBridge.exe itself when TELEPHONY_PROVIDER=tapi.

set "ROOT=%~dp0"

if not exist "%ROOT%server\node_modules" (
  echo Server dependencies are missing. Run: cd server ^&^& npm install
  pause
  exit /b 1
)

if not exist "%ROOT%client\node_modules" (
  echo Client dependencies are missing. Run: cd client ^&^& npm install
  pause
  exit /b 1
)

if not exist "%ROOT%kitchen\node_modules" (
  echo Kitchen dependencies are missing. Run: cd kitchen ^&^& npm install
  pause
  exit /b 1
)

if not exist "%ROOT%server\.env" (
  echo server\.env is missing. Copy server\.env.example to server\.env and configure it.
  pause
  exit /b 1
)

echo Starting POS server...
start "POS Server" /D "%ROOT%server" cmd /k "npm.cmd start"

echo Starting POS client...
start "POS Client" /D "%ROOT%client" cmd /k "npm.cmd run dev"

echo Starting kitchen display...
start "Kitchen Display" /D "%ROOT%kitchen" cmd /k "npm.cmd run dev"

echo Waiting for the POS client...
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo Services started. Close their terminal windows to stop them.
endlocal
