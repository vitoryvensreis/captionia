@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Caption IA - Instalador

set "SRC=%~dp0CaptionIA"
set "BASE=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%BASE%\CaptionIA"
set "OLD1=%BASE%\editBest"
set "OLD2=%BASE%\FrameSpeed"
set "OLD3=%BASE%\framespeed"
set "STAGE=%TEMP%\CaptionIA_install_%RANDOM%_%RANDOM%"
set "NEW_VERSION=desconhecida"
set "FOUND_OLD=0"
set "RC=0"

cls
echo ============================================================
echo                    CAPTION IA
echo                 INSTALADOR WINDOWS
echo ============================================================
echo.

rem ------------------------------------------------------------
rem 1) Validar o pacote antes de tocar na instalacao atual
rem ------------------------------------------------------------
if not exist "%SRC%\CSXS\manifest.xml" goto :SOURCE_ERROR
if not exist "%SRC%\index.html" goto :SOURCE_ERROR
if not exist "%SRC%\js\main.js" goto :SOURCE_ERROR

call :GET_VERSION "%SRC%" NEW_VERSION

echo Versao do pacote: !NEW_VERSION!
echo.

rem ------------------------------------------------------------
rem 2) Premiere precisa estar fechado para uma troca segura
rem ------------------------------------------------------------
tasklist /FI "IMAGENAME eq Adobe Premiere Pro.exe" 2>nul | find /I "Adobe Premiere Pro.exe" >nul
if not errorlevel 1 goto :PREMIERE_OPEN

if not exist "%BASE%" (
    mkdir "%BASE%" >nul 2>&1
    if errorlevel 1 goto :PERMISSION_ERROR
)

rem ------------------------------------------------------------
rem 3) Preparar a nova versao numa pasta temporaria
rem    Se isso falhar, a versao instalada nao e removida.
rem ------------------------------------------------------------
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
mkdir "%STAGE%" >nul 2>&1
if errorlevel 1 goto :PERMISSION_ERROR

echo [1/4] Validando arquivos da nova versao...
robocopy "%SRC%" "%STAGE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=!ERRORLEVEL!"
if !RC! GEQ 8 goto :COPY_ERROR

if not exist "%STAGE%\CSXS\manifest.xml" goto :COPY_ERROR
if not exist "%STAGE%\index.html" goto :COPY_ERROR
if not exist "%STAGE%\js\main.js" goto :COPY_ERROR
findstr /I /C:"com.editbest.panel" "%STAGE%\CSXS\manifest.xml" >nul 2>&1
if errorlevel 1 goto :COPY_ERROR

echo       Pacote validado.
echo.
echo [2/4] Procurando versoes instaladas...

call :REPORT_INSTALL "%DEST%" "Caption IA"
call :REPORT_INSTALL "%OLD1%" "editBest"
call :REPORT_INSTALL "%OLD2%" "FrameSpeed"
call :REPORT_INSTALL "%OLD3%" "framespeed"

rem Procura tambem qualquer pasta CEP com o mesmo Extension ID,
rem mesmo que tenha sido renomeada pelo usuario ou por um instalador antigo.
for /d %%D in ("%BASE%\*") do (
    if exist "%%~fD\CSXS\manifest.xml" (
        findstr /I /C:"com.editbest.panel" "%%~fD\CSXS\manifest.xml" >nul 2>&1
        if not errorlevel 1 (
            set "P=%%~fD"
            if /I not "!P!"=="%DEST%" if /I not "!P!"=="%OLD1%" if /I not "!P!"=="%OLD2%" if /I not "!P!"=="%OLD3%" (
                set "FOUND_OLD=1"
                call :GET_VERSION "%%~fD" DETECTED_VERSION
                echo       Encontrada: %%~nxD  ^(versao !DETECTED_VERSION!^)
            )
        )
    )
)

if "!FOUND_OLD!"=="0" (
    echo       Nenhuma instalacao anterior encontrada.
) else (
    echo       A instalacao anterior sera substituida.
)

echo.
echo [3/4] Instalando Caption IA !NEW_VERSION!...

rem Remove somente instalacoes reconhecidas do Caption IA/editBest/FrameSpeed.
call :REMOVE_KNOWN "%DEST%"
call :REMOVE_KNOWN "%OLD1%"
call :REMOVE_KNOWN "%OLD2%"
call :REMOVE_KNOWN "%OLD3%"

rem Remove pastas remanescentes que declaram o mesmo Extension ID.
for /d %%D in ("%BASE%\*") do (
    if exist "%%~fD\CSXS\manifest.xml" (
        findstr /I /C:"com.editbest.panel" "%%~fD\CSXS\manifest.xml" >nul 2>&1
        if not errorlevel 1 (
            echo       Removendo instalacao antiga: %%~nxD
            rmdir /s /q "%%~fD" >nul 2>&1
            if exist "%%~fD" goto :REMOVE_ERROR
        )
    )
)

mkdir "%DEST%" >nul 2>&1
if errorlevel 1 goto :PERMISSION_ERROR

robocopy "%STAGE%" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=!ERRORLEVEL!"
if !RC! GEQ 8 goto :INSTALL_ERROR

if not exist "%DEST%\CSXS\manifest.xml" goto :INSTALL_ERROR
if not exist "%DEST%\index.html" goto :INSTALL_ERROR
if not exist "%DEST%\js\main.js" goto :INSTALL_ERROR

for %%V in (9 10 11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1

echo.
echo [4/4] Conferindo instalacao...
call :GET_VERSION "%DEST%" INSTALLED_VERSION

echo.
echo ============================================================
echo              CAPTION IA INSTALADO COM SUCESSO
echo ============================================================
echo.
echo Versao instalada: !INSTALLED_VERSION!
echo Pasta: %DEST%
echo.
echo Suas configuracoes e sessao em Documentos\editBest
echo foram preservadas.
echo.
echo Abra o Adobe Premiere Pro e acesse:
echo Janela ^> Extensoes ^> Caption IA
echo.
goto :END_OK

:GET_VERSION
set "CIA_MANIFEST=%~1\CSXS\manifest.xml"
set "TMP_VERSION="
for /f "usebackq delims=" %%V in (`powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='SilentlyContinue'; try { [xml]$m=Get-Content -Raw -LiteralPath $env:CIA_MANIFEST; [Console]::Write($m.ExtensionManifest.ExtensionBundleVersion) } catch {}" 2^>nul`) do set "TMP_VERSION=%%V"
if not defined TMP_VERSION set "TMP_VERSION=desconhecida"
set "%~2=!TMP_VERSION!"
set "CIA_MANIFEST="
exit /b 0

:REPORT_INSTALL
if not exist "%~1" exit /b 0
set "FOUND_OLD=1"
call :GET_VERSION "%~1" DETECTED_VERSION
echo       Encontrada: %~2  ^(versao !DETECTED_VERSION!^)
exit /b 0

:REMOVE_KNOWN
if not exist "%~1" exit /b 0
rmdir /s /q "%~1" >nul 2>&1
if exist "%~1" goto :REMOVE_ERROR
exit /b 0

:PREMIERE_OPEN
cls
echo ============================================================
echo                 FECHE O PREMIERE PRO
echo ============================================================
echo.
echo O Adobe Premiere Pro esta aberto.
echo.
echo Salve seu projeto, feche o Premiere e execute este
echo instalador novamente.
echo.
echo Nenhum arquivo foi alterado.
echo.
goto :END_ERROR

:SOURCE_ERROR
cls
echo ============================================================
echo             PACOTE DO CAPTION IA INCOMPLETO
echo ============================================================
echo.
echo O instalador precisa ficar ao lado da pasta:
echo.
echo   CaptionIA\
echo.
echo Extraia o ZIP completo antes de executar este arquivo.
echo.
goto :END_ERROR

:COPY_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo ============================================================
echo           NAO FOI POSSIVEL VALIDAR O PACOTE
echo ============================================================
echo.
echo A nova versao nao passou pela etapa de preparacao.
echo A instalacao atual nao foi removida.
echo.
echo Extraia novamente o ZIP e tente outra vez.
echo.
goto :END_ERROR

:REMOVE_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo ============================================================
echo          NAO FOI POSSIVEL TROCAR A VERSAO ANTIGA
echo ============================================================
echo.
echo Confirme que o Premiere Pro esta fechado.
echo Se continuar, execute este BAT como administrador.
echo.
goto :END_ERROR

:INSTALL_ERROR
if exist "%DEST%" rmdir /s /q "%DEST%" >nul 2>&1
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo ============================================================
echo               ERRO DURANTE A INSTALACAO
echo ============================================================
echo.
echo Nao foi possivel concluir a copia para:
echo %DEST%
echo.
echo Feche os aplicativos Adobe e tente novamente.
echo.
goto :END_ERROR

:PERMISSION_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo ============================================================
echo                  ERRO DE PERMISSAO
echo ============================================================
echo.
echo O Windows nao permitiu alterar a pasta de extensoes da Adobe.
echo.
echo Clique com o botao direito em INSTALAR_CAPTION_IA.bat
echo e escolha "Executar como administrador".
echo.
goto :END_ERROR

:END_OK
echo Pressione qualquer tecla para fechar.
pause >nul
endlocal
exit /b 0

:END_ERROR
echo Pressione qualquer tecla para fechar.
pause >nul
endlocal
exit /b 1
