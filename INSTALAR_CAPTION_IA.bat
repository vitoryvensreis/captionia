@echo off
setlocal EnableExtensions
title Instalador Caption IA 3.1.0

set "SRC=%~dp0CaptionIA"
set "BASE=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%BASE%\CaptionIA"
set "LEGACY=%BASE%\editBest"
set "BACKUP=%BASE%\CaptionIA.__backup_%RANDOM%_%RANDOM%"
set "STAGE=%BASE%\CaptionIA.__stage_%RANDOM%_%RANDOM%"
set "BACKUP_ORIGIN="

echo.
echo ==========================================
echo   Caption IA 3.1.0 - Instalacao CEP segura
echo ==========================================
echo.

if not exist "%SRC%\CSXS\manifest.xml" (
  echo ERRO: pasta do plugin nao encontrada:
  echo %SRC%
  pause
  exit /b 1
)

if not exist "%BASE%" mkdir "%BASE%" >nul 2>&1
if exist "%STAGE%" rmdir /S /Q "%STAGE%"
mkdir "%STAGE%" >nul 2>&1

echo 1/4 Copiando para area temporaria...
xcopy "%SRC%\*" "%STAGE%\" /E /I /H /Y >nul
if errorlevel 1 goto :copy_fail
if not exist "%STAGE%\CSXS\manifest.xml" goto :copy_fail
if not exist "%STAGE%\index.html" goto :copy_fail
if not exist "%STAGE%\js\main.js" goto :copy_fail

echo 2/4 Validando pacote...
findstr /C:"ExtensionBundleVersion=\"3.1.0\"" "%STAGE%\CSXS\manifest.xml" >nul
if errorlevel 1 goto :copy_fail
findstr /C:"ExtensionBundleName=\"Caption IA\"" "%STAGE%\CSXS\manifest.xml" >nul
if errorlevel 1 goto :copy_fail

echo 3/4 Preparando atualizacao...
if exist "%DEST%" (
  set "BACKUP_ORIGIN=DEST"
  move "%DEST%" "%BACKUP%" >nul
  if errorlevel 1 goto :swap_fail
) else if exist "%LEGACY%" (
  set "BACKUP_ORIGIN=LEGACY"
  echo Migrando instalacao anterior do editBest para Caption IA...
  move "%LEGACY%" "%BACKUP%" >nul
  if errorlevel 1 goto :swap_fail
) else (
  echo Primeira instalacao detectada.
)

echo 4/4 Ativando nova versao...
move "%STAGE%" "%DEST%" >nul
if errorlevel 1 goto :restore
if exist "%BACKUP%" rmdir /S /Q "%BACKUP%"

for %%V in (9 10 11 12 13 14) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo.
echo Caption IA instalado com sucesso em:
echo %DEST%
echo.
echo A versao anterior so e removida depois que a nova copia passa pela validacao.
echo Os dados antigos em Documentos\editBest sao preservados por compatibilidade.
echo Feche e abra o Adobe Premiere Pro e procure em Janela ^> Extensoes por "Caption IA".
echo.
pause
exit /b 0

:copy_fail
echo ERRO: a copia temporaria falhou ou ficou incompleta.
if exist "%STAGE%" rmdir /S /Q "%STAGE%"
echo A instalacao atual nao foi alterada.
pause
exit /b 1

:swap_fail
echo ERRO: nao consegui preparar a troca da versao atual.
if exist "%STAGE%" rmdir /S /Q "%STAGE%"
echo A instalacao atual continua no lugar.
pause
exit /b 1

:restore
echo ERRO: falha ao ativar a nova versao. Restaurando a anterior...
if exist "%DEST%" rmdir /S /Q "%DEST%"
if exist "%BACKUP%" (
  if "%BACKUP_ORIGIN%"=="LEGACY" (
    move "%BACKUP%" "%LEGACY%" >nul
  ) else (
    move "%BACKUP%" "%DEST%" >nul
  )
)
if exist "%STAGE%" rmdir /S /Q "%STAGE%"
echo Restauracao concluida. Nenhuma atualizacao parcial foi mantida.
pause
exit /b 1
