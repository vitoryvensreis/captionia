@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Caption IA - Montagem Inteligente BETA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR_BETA_WINDOWS.ps1"
if errorlevel 1 (
  echo.
  echo Falha na instalacao. Consulte o erro acima.
)
echo.
pause
