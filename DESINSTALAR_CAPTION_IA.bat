@echo off
setlocal
title Desinstalar Caption IA
set "BASE=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%BASE%\CaptionIA"
set "LEGACY=%BASE%\editBest"
set "REMOVED=0"
if exist "%DEST%" (
  rmdir /S /Q "%DEST%"
  set "REMOVED=1"
)
if exist "%LEGACY%" (
  rmdir /S /Q "%LEGACY%"
  set "REMOVED=1"
)
if "%REMOVED%"=="1" (
  echo Caption IA removido.
) else (
  echo Caption IA nao esta instalado nesta pasta de usuario.
)
echo Feche e abra o Premiere Pro.
pause
endlocal
