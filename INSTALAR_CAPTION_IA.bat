@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA - Instalacao segura
set "SOURCE=%~dp0CaptionIA"
set "BASE=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%BASE%\CaptionIA"
set "STAGE=%BASE%\CaptionIA_TEMP_NOVA"
set "PREVIOUS=%BASE%\CaptionIA_TEMP_ANTERIOR"
set "BACKBASE=%LOCALAPPDATA%\CaptionIA\Backups"
set "BACKUP=%BACKBASE%\CaptionIA_ANTES_3_4_1"
set "RC=0"

echo =====================================================
echo          CAPTION IA 3.4.1 - INSTALADOR WINDOWS
echo =====================================================
echo.
echo [AVISO] Esta distribuicao CEP exige modo de desenvolvedor.
echo Para distribuicao comercial final, prefira extensao assinada.
echo.
if not exist "%SOURCE%\CSXS\manifest.xml" goto :source
if not exist "%SOURCE%\jsx\hostscript.jsxbin" goto :source
if not exist "%SOURCE%\js\cloud_audio_panel.js" goto :source
if not exist "%SOURCE%\js\cloud_core.js" goto :source
if not exist "%SOURCE%\js\sfx_dual_tracks.js" goto :source
if not exist "%SOURCE%\js\main.js" goto :source
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :opened
tasklist /FI "IMAGENAME eq AfterFX.exe" 2>nul | find /I "AfterFX.exe" >nul
if not errorlevel 1 goto :opened
if exist "%STAGE%" goto :dirty
if exist "%PREVIOUS%" goto :dirty
if not exist "%BASE%" mkdir "%BASE%"
if errorlevel 1 goto :error
if exist "%BACKUP%\CSXS\manifest.xml" goto :backup_exists

echo [1/5] Preparando os arquivos da nova versao...
robocopy "%SOURCE%" "%STAGE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 goto :failed_stage
if not exist "%STAGE%\CSXS\manifest.xml" goto :failed_stage
if not exist "%STAGE%\jsx\hostscript.jsxbin" goto :failed_stage
if not exist "%STAGE%\js\cloud_audio_panel.js" goto :failed_stage

echo [2/5] Preservando a versao anterior, caso exista...
if exist "%DEST%\CSXS\manifest.xml" (
 if not exist "%BACKBASE%" mkdir "%BACKBASE%"
 if errorlevel 1 goto :failed_stage
 robocopy "%DEST%" "%BACKUP%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
 if errorlevel 8 goto :failed_stage
 if not exist "%BACKUP%\CSXS\manifest.xml" goto :failed_stage
)

echo [3/5] Ativando a nova versao...
if exist "%DEST%" (
 move "%DEST%" "%PREVIOUS%" >nul
 if errorlevel 1 goto :failed_stage
)
move "%STAGE%" "%DEST%" >nul
if errorlevel 1 goto :restore

echo [4/5] Validando a instalacao...
if not exist "%DEST%\js\cloud_audio_panel.js" goto :restore
if not exist "%DEST%\js\cloud_core.js" goto :restore
if not exist "%DEST%\jsx\hostscript.jsxbin" goto :restore

echo [5/5] Finalizando...
if exist "%PREVIOUS%" rmdir /s /q "%PREVIOUS%" >nul 2>&1
rem CEP legado nao assinado: esta configuracao de desenvolvimento deve ser eliminada na distribuicao assinada.
for %%V in (9 10 11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo.
echo CAPTION IA 3.4.1 INSTALADO.
echo Backup da versao anterior: "%BACKUP%"
echo Abra o Premiere - Janela - Extensoes - Caption IA.
echo Faça login para usar GROQ sem chave local.
echo.
pause
exit /b 0

:restore
echo Falha ao ativar o novo plugin; recuperando a instalacao anterior...
if exist "%DEST%" rmdir /s /q "%DEST%" >nul 2>&1
if exist "%PREVIOUS%" move "%PREVIOUS%" "%DEST%" >nul
goto :error

:failed_stage
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
goto :error

:source
echo Pacote incompleto. Extraia todo o ZIP antes de executar.
goto :error

:opened
echo Feche Premiere Pro e After Effects, salvando seus projetos.
goto :error

:dirty
echo Pasta de instalacao interrompida encontrada:
echo "%STAGE%"
echo "%PREVIOUS%"
echo Para nao perder dados, instalacao cancelada. Contate suporte.
goto :error

:backup_exists
echo Um backup anterior ja existe em "%BACKUP%".
echo Preserve/renomeie esse backup antes de reinstalar.
goto :error

:error
echo.
echo INSTALACAO CANCELADA. Nenhum backup existente foi apagado.
echo.
pause
exit /b 1
