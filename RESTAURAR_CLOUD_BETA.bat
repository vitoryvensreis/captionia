@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA - Restaurar Versao Anterior
set "DEST=%APPDATA%\Adobe\CEP\extensions\CaptionIA"
set "BACK=%LOCALAPPDATA%\CaptionIA\CloudBetaBackup\CaptionIA"
set "STAGE=%APPDATA%\Adobe\CEP\extensions\CaptionIA_RESTORE_STAGE"
set "BETA=%APPDATA%\Adobe\CEP\extensions\CaptionIA_BETA_PREVIOUS"
echo ===================================================
echo      CAPTION IA - RESTAURAR A VERSAO ANTERIOR
echo ===================================================
if not exist "%BACK%\CSXS\manifest.xml" goto :notfound
if exist "%STAGE%" goto :error
if exist "%BETA%" goto :error
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :open
tasklist /FI "IMAGENAME eq AfterFX.exe" 2>nul | find /I "AfterFX.exe" >nul
if not errorlevel 1 goto :open
echo [1/3] Preparando copia verificada do backup...
robocopy "%BACK%" "%STAGE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
if not exist "%STAGE%\CSXS\manifest.xml" goto :error
echo [2/3] Trocando versoes...
if exist "%DEST%" (
 move "%DEST%" "%BETA%" >nul
 if errorlevel 1 goto :error
)
move "%STAGE%" "%DEST%" >nul
if errorlevel 1 goto :recover
echo [3/3] Instalacao anterior restaurada.
if exist "%BETA%" rmdir /s /q "%BETA%" >nul 2>&1
echo Backup original preservado em "%BACK%".
goto :success
:recover
echo Falha ao ativar versao anterior; tentando recuperar a beta...
if exist "%BETA%" move "%BETA%" "%DEST%" >nul
goto :error
:open
echo Feche Premiere e After Effects antes de restaurar.
goto :error
:notfound
echo Backup nao encontrado. Nenhuma alteracao feita.
goto :error
:success
echo.
pause
exit /b 0
:error
echo.
echo Verifique os arquivos; backup nao foi apagado.
pause
exit /b 1
