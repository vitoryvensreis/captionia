@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA - Corrigir AutoSFX (Beta)
set "SOURCE=%~dp0CaptionIA"
set "DEST=%APPDATA%\Adobe\CEP\extensions\CaptionIA"
set "BACKUP=%LOCALAPPDATA%\CaptionIA\SfxFixBackup"
echo ==========================================
echo      CAPTION IA - PATCH AUTOSFX
echo ==========================================
echo.
if not exist "%SOURCE%\js\autosfx.js" goto :badpackage
if not exist "%SOURCE%\js\sfx_scheduler.js" goto :badpackage
if not exist "%SOURCE%\index.html" goto :badpackage
if not exist "%DEST%\js\autosfx.js" goto :notinstalled
if not exist "%DEST%\CSXS\manifest.xml" goto :notinstalled
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :close
tasklist /FI "IMAGENAME eq AfterFX.exe" 2>nul | find /I "AfterFX.exe" >nul
if not errorlevel 1 goto :close
if exist "%BACKUP%\autosfx.js" goto :exists
if exist "%BACKUP%\index.html" goto :exists
mkdir "%BACKUP%" >nul 2>&1
if errorlevel 1 goto :failed
echo [1/3] Guardando os arquivos originais...
copy /B /Y "%DEST%\js\autosfx.js" "%BACKUP%\autosfx.js" >nul
if errorlevel 1 goto :failed
copy /B /Y "%DEST%\index.html" "%BACKUP%\index.html" >nul
if errorlevel 1 goto :failed
if exist "%DEST%\js\sfx_scheduler.js" (
 copy /B /Y "%DEST%\js\sfx_scheduler.js" "%BACKUP%\sfx_scheduler.js" >nul
 if errorlevel 1 goto :failed
)
echo [2/3] Instalando o novo agendador de efeitos...
copy /B /Y "%SOURCE%\js\sfx_scheduler.js" "%DEST%\js\sfx_scheduler.js" >nul
if errorlevel 1 goto :rollback
copy /B /Y "%SOURCE%\js\autosfx.js" "%DEST%\js\autosfx.js" >nul
if errorlevel 1 goto :rollback
copy /B /Y "%SOURCE%\index.html" "%DEST%\index.html" >nul
if errorlevel 1 goto :rollback
echo [3/3] Conferindo a instalacao...
if not exist "%DEST%\js\sfx_scheduler.js" goto :rollback
echo.
echo PATCH AUTOSFX INSTALADO.
echo Backup salvo em: "%BACKUP%"
echo Para desfazer use RESTAURAR_PATCH_SFX.bat.
pause
exit /b 0
:rollback
echo Falha na instalacao. Restaurando...
if exist "%BACKUP%\autosfx.js" copy /B /Y "%BACKUP%\autosfx.js" "%DEST%\js\autosfx.js" >nul
if exist "%BACKUP%\index.html" copy /B /Y "%BACKUP%\index.html" "%DEST%\index.html" >nul
if exist "%BACKUP%\sfx_scheduler.js" (
 copy /B /Y "%BACKUP%\sfx_scheduler.js" "%DEST%\js\sfx_scheduler.js" >nul
) else (
 if exist "%DEST%\js\sfx_scheduler.js" del /Q "%DEST%\js\sfx_scheduler.js"
)
goto :failed
:close
echo Feche Premiere e After Effects completamente antes de continuar.
goto :failed
:exists
echo Ja existe backup deste patch. Nao instale por cima.
echo Use RESTAURAR_PATCH_SFX.bat antes de repetir.
goto :failed
:notinstalled
echo Extensao CaptionIA CEP nao encontrada. Este patch requer o Cloud Beta instalado.
goto :failed
:badpackage
echo Arquivos do patch ausentes. Extraia o ZIP completo antes de executar.
goto :failed
:failed
echo Operacao nao concluida; backup nao foi apagado.
pause
exit /b 1
