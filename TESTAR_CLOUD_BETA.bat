@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA - Instalar Beta Cloud com Backup
set "SRC=%~dp0CaptionIA"
set "BASE=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%BASE%\CaptionIA"
set "BROOT=%LOCALAPPDATA%\CaptionIA\CloudBetaBackup"
set "BACK=%BROOT%\CaptionIA"
set "STAGE=%BASE%\CaptionIA_CLOUD_STAGE"
set "PREV=%BASE%\CaptionIA_CLOUD_PREVIOUS"
echo ==================================================
echo      CAPTION IA - BETA CLOUD - TESTE WINDOWS
echo ==================================================
echo.
if not exist "%SRC%\CSXS\manifest.xml" goto :source_error
if not exist "%SRC%\js\cloud_core.js" goto :source_error
if not exist "%SRC%\js\cloud_captions_ui.js" goto :source_error
if not exist "%SRC%\js\cloud_audio_panel.js" goto :source_error
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :apps_open
tasklist /FI "IMAGENAME eq AfterFX.exe" 2>nul | find /I "AfterFX.exe" >nul
if not errorlevel 1 goto :apps_open
if not exist "%DEST%\CSXS\manifest.xml" goto :missing_current
if exist "%BACK%" goto :backup_exists
if exist "%STAGE%" goto :stage_exists
if exist "%PREV%" goto :stage_exists
mkdir "%BROOT%" >nul 2>&1
if errorlevel 1 goto :error
echo [1/5] Backup integral da instalacao CEP atual...
robocopy "%DEST%" "%BACK%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
if not exist "%BACK%\CSXS\manifest.xml" goto :error
echo [2/5] Preparando beta numa pasta temporaria...
robocopy "%SRC%" "%STAGE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
if not exist "%STAGE%\CSXS\manifest.xml" goto :error
echo [3/5] Deslocando instalacao atual (reversivel)...
move "%DEST%" "%PREV%" >nul
if errorlevel 1 goto :error
echo [4/5] Ativando beta...
move "%STAGE%" "%DEST%" >nul
if errorlevel 1 goto :restore_previous
echo [5/5] Conferindo e finalizando...
if not exist "%DEST%\js\cloud_core.js" goto :restore_previous
if not exist "%DEST%\js\cloud_captions_ui.js" goto :restore_previous
if not exist "%DEST%\js\cloud_audio_panel.js" goto :restore_previous
rmdir /s /q "%PREV%" >nul 2>&1
echo.
echo Instalacao beta concluida.
echo Backup: "%BACK%"
echo Para restaurar use RESTAURAR_CLOUD_BETA.bat.
echo Suas preferencias em Documentos\editBest nao foram alteradas.
goto :end_ok
:restore_previous
echo [ERRO] Restaurando instalacao anterior...
if exist "%DEST%" rmdir /s /q "%DEST%" >nul 2>&1
if exist "%PREV%" move "%PREV%" "%DEST%" >nul
goto :error
:source_error
echo Pacote beta incompleto. Extraia todo o ZIP primeiro.
goto :error
:apps_open
echo Feche o Premiere e o After Effects, salve seus projetos e tente novamente.
goto :error
:missing_current
echo Instalacao CEP atual nao encontrada em "%DEST%".
echo Instale primeiro a versao estavel 3.4.0.
goto :error
:backup_exists
echo Ja existe backup beta em "%BACK%".
echo Para evitar sobrescrever seu backup, execute RESTAURAR_CLOUD_BETA.bat antes de repetir o teste.
goto :error
:stage_exists
echo Arquivos temporarios de uma instalacao anterior foram detectados.
echo Nao execute novamente ate recuperar a instalacao anterior.
goto :error
:end_ok
echo.
pause
exit /b 0
:error
echo.
echo Operacao interrompida. Verifique o estado das pastas e mantenha o backup.
echo.
pause
exit /b 1
