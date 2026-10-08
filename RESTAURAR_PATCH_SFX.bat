@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title Caption IA - Desfazer AutoSFX Patch
set "DEST=%APPDATA%\Adobe\CEP\extensions\CaptionIA"
set "BACKUP=%LOCALAPPDATA%\CaptionIA\SfxTimingCalibrationBackup"
echo ==========================================
echo      CAPTION IA - RESTAURAR AUTOSFX
echo ==========================================
if not exist "%BACKUP%\autosfx.js" goto :missing
if not exist "%BACKUP%\index.html" goto :missing
if not exist "%DEST%\js" goto :missing
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :close
tasklist /FI "IMAGENAME eq AfterFX.exe" 2>nul | find /I "AfterFX.exe" >nul
if not errorlevel 1 goto :close
echo Restaurando copia anterior...
copy /B /Y "%BACKUP%\autosfx.js" "%DEST%\js\autosfx.js" >nul
if errorlevel 1 goto :failed
copy /B /Y "%BACKUP%\index.html" "%DEST%\index.html" >nul
if errorlevel 1 goto :failed
if exist "%BACKUP%\sfx_timing_calibration.js" (
 copy /B /Y "%BACKUP%\sfx_timing_calibration.js" "%DEST%\js\sfx_timing_calibration.js" >nul
 if errorlevel 1 goto :failed
) else (
 if exist "%DEST%\js\sfx_timing_calibration.js" del /Q "%DEST%\js\sfx_timing_calibration.js"
)
if exist "%BACKUP%\sfx_track_diagnostics.js" (
 copy /B /Y "%BACKUP%\sfx_track_diagnostics.js" "%DEST%\js\sfx_track_diagnostics.js" >nul
 if errorlevel 1 goto :failed
) else (
 if exist "%DEST%\js\sfx_track_diagnostics.js" del /Q "%DEST%\js\sfx_track_diagnostics.js"
)
if exist "%BACKUP%\sfx_dual_tracks.js" (
 copy /B /Y "%BACKUP%\sfx_dual_tracks.js" "%DEST%\js\sfx_dual_tracks.js" >nul
 if errorlevel 1 goto :failed
) else (
 if exist "%DEST%\js\sfx_dual_tracks.js" del /Q "%DEST%\js\sfx_dual_tracks.js"
)
if exist "%BACKUP%\sfx_scheduler.js" (
 copy /B /Y "%BACKUP%\sfx_scheduler.js" "%DEST%\js\sfx_scheduler.js" >nul
 if errorlevel 1 goto :failed
) else (
 if exist "%DEST%\js\sfx_scheduler.js" del /Q "%DEST%\js\sfx_scheduler.js"
)
echo Restaurado. Backup mantido por seguranca.
pause
exit /b 0
:missing
echo Backup ou extensao ausente; nenhuma alteracao feita.
goto :failed
:close
echo Feche Premiere e After Effects antes de restaurar.
:failed
pause
exit /b 1
