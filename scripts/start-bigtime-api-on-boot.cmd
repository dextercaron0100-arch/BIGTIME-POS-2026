@echo off
setlocal

set "ROOT=C:\Users\dexte\OneDrive\Desktop\PROKECY BACKUP\PROJECT 2026\POS SYSTEM"
set "LOG=%ROOT%\api-dev-autostart.log"
set "ERR=%ROOT%\api-dev-autostart.err.log"
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

if not exist "%NPM_CMD%" (
  >>"%ERR%" echo [%date% %time%] npm.cmd was not found at "%NPM_CMD%".
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  >>"%LOG%" echo [%date% %time%] Port 3000 is already listening on PID %%P. Skipping auto-start.
  exit /b 0
)

cd /d "%ROOT%"
>>"%LOG%" echo [%date% %time%] Starting BIGTIME POS API auto-start task.
call "%NPM_CMD%" run start:dev -w @apex-pos/api >>"%LOG%" 2>>"%ERR%"
>>"%ERR%" echo [%date% %time%] BIGTIME POS API auto-start exited with code %ERRORLEVEL%.
exit /b %ERRORLEVEL%
