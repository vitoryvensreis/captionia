@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA 3.6.2 - Instalador
cd /d "%~dp0"

echo.
echo =========================================================
echo      CAPTION IA 3.6.2 - INSTALADOR CORRIGIDO
echo =========================================================
echo.
echo IMPORTANTE: feche Premiere, After Effects e Media Encoder.
echo Este instalador guarda uma copia da versao antiga.
echo.

if not exist "%~dp0CaptionIA\CSXS\manifest.xml" goto :missing
if not exist "%~dp0CaptionIA\jsx\hostscript.jsxbin" goto :missing
if not exist "%~dp0INSTALAR_CAPTION_IA.ps1" goto :missing
where powershell.exe >nul 2>&1
if errorlevel 1 goto :nopowershell

powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0INSTALAR_CAPTION_IA.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
 echo INSTALACAO CONCLUIDA. Abra Premiere ^> Janela ^> Extensoes.
) else (
 echo FALHA NA INSTALACAO ^(codigo %RESULT%^).
 echo O diagnostico foi salvo em %%LOCALAPPDATA%%\CaptionIA\Logs
 echo Se pedir ajuda, envie o texto do erro que aparece acima.
)
echo.
pause
exit /b %RESULT%

:missing
echo ERRO: o pacote esta incompleto OU o BAT foi executado dentro do ZIP.
echo Extraia o ZIP todo e abra o arquivo INSTALAR_CAPTION_IA.bat
echo na pasta principal, AO LADO da pasta CaptionIA.
echo.
pause
exit /b 2

:nopowershell
echo ERRO: Windows PowerShell nao encontrado neste computador.
pause
exit /b 3
