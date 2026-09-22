@echo off
rem ============================================
rem  AICOLLIDER - roda dev sem depender do PATH
rem ============================================
set "NODE_DIR=C:\Users\Bruno\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%~dp0"
echo [AICOLLIDER] Abrindo servidor em http://localhost:5173
npm run dev
pause