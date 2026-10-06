@echo off
setlocal EnableExtensions
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
set "RC=0"

cls
echo =====================================================
echo              CAPTION IA - INSTALADOR
echo =====================================================
echo.
echo Este instalador remove a versao antiga, se existir,
echo e instala a versao nova do Caption IA.
echo.
echo IMPORTANTE: feche o Adobe Premiere Pro antes de continuar.
echo.
pause

rem -------------------------------------------------------
rem 1) Validar o pacote que veio junto com este instalador
rem -------------------------------------------------------
if not exist "%SRC%\CSXS\manifest.xml" goto :SOURCE_ERROR
if not exist "%SRC%\index.html" goto :SOURCE_ERROR
if not exist "%SRC%\js\main.js" goto :SOURCE_ERROR

if not exist "%BASE%" (
    mkdir "%BASE%" >nul 2>&1
    if errorlevel 1 goto :PERMISSION_ERROR
)

rem -------------------------------------------------------
rem 2) Copiar primeiro para uma pasta temporaria e validar
rem -------------------------------------------------------
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
mkdir "%STAGE%" >nul 2>&1
if errorlevel 1 goto :PERMISSION_ERROR

echo.
echo [1/4] Preparando a nova versao...
robocopy "%SRC%" "%STAGE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 goto :COPY_ERROR

if not exist "%STAGE%\CSXS\manifest.xml" goto :COPY_ERROR
if not exist "%STAGE%\index.html" goto :COPY_ERROR
if not exist "%STAGE%\js\main.js" goto :COPY_ERROR

findstr /I /C:"Caption IA" "%STAGE%\CSXS\manifest.xml" >nul 2>&1
if errorlevel 1 goto :COPY_ERROR

rem -------------------------------------------------------
rem 3) Remover instalacoes antigas APENAS se existirem
rem -------------------------------------------------------
echo [2/4] Verificando instalacoes antigas...

if exist "%DEST%" (
    echo       Removendo Caption IA anterior...
    rmdir /s /q "%DEST%" >nul 2>&1
    if exist "%DEST%" goto :REMOVE_ERROR
)

if exist "%OLD1%" (
    echo       Removendo editBest antigo...
    rmdir /s /q "%OLD1%" >nul 2>&1
    if exist "%OLD1%" goto :REMOVE_ERROR
)

if exist "%OLD2%" (
    echo       Removendo FrameSpeed antigo...
    rmdir /s /q "%OLD2%" >nul 2>&1
    if exist "%OLD2%" goto :REMOVE_ERROR
)

if exist "%OLD3%" (
    echo       Removendo framespeed antigo...
    rmdir /s /q "%OLD3%" >nul 2>&1
    if exist "%OLD3%" goto :REMOVE_ERROR
)

echo       Verificacao concluida.

rem -------------------------------------------------------
rem 4) Instalar a nova versao
rem -------------------------------------------------------
echo [3/4] Instalando a nova versao...
mkdir "%DEST%" >nul 2>&1
if errorlevel 1 goto :PERMISSION_ERROR

robocopy "%STAGE%" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 goto :INSTALL_ERROR

if not exist "%DEST%\CSXS\manifest.xml" goto :INSTALL_ERROR
if not exist "%DEST%\index.html" goto :INSTALL_ERROR
if not exist "%DEST%\js\main.js" goto :INSTALL_ERROR

for %%V in (9 10 11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1

echo [4/4] Finalizando...
echo.
echo =====================================================
echo        CAPTION IA INSTALADO COM SUCESSO
echo =====================================================
echo.
echo Instalado em:
echo %DEST%
echo.
echo Se nao havia versao antiga, nenhuma remocao foi feita:
echo o instalador apenas instalou a nova versao.
echo.
echo Os dados em Documentos\editBest NAO foram apagados.
echo Isso preserva preferencias, cache e chave da API.
echo.
echo Agora abra novamente o Adobe Premiere Pro e procure por:
echo Janela ^> Extensoes ^> Caption IA
echo.
goto :END_OK

:SOURCE_ERROR
cls
echo =====================================================
echo ERRO: A PASTA DO CAPTION IA NAO FOI ENCONTRADA
echo =====================================================
echo.
echo Este arquivo BAT precisa ficar ao lado da pasta:
echo.
echo   CaptionIA\
echo.
echo Caminho esperado:
echo %SRC%
echo.
echo Extraia o ZIP COMPLETO antes de executar o instalador.
echo.
goto :END_ERROR

:COPY_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo =====================================================
echo ERRO AO PREPARAR A NOVA VERSAO
echo =====================================================
echo.
echo A copia para a pasta temporaria falhou ou ficou incompleta.
echo Nenhuma versao antiga foi removida.
echo.
goto :END_ERROR

:REMOVE_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo =====================================================
echo ERRO AO REMOVER A VERSAO ANTIGA
echo =====================================================
echo.
echo Feche o Premiere Pro e qualquer outro programa Adobe
echo e execute este instalador novamente.
echo.
echo Se continuar, clique com o botao direito no BAT e use:
echo "Executar como administrador".
echo.
goto :END_ERROR

:INSTALL_ERROR
if exist "%DEST%" rmdir /s /q "%DEST%" >nul 2>&1
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo =====================================================
echo ERRO AO INSTALAR O CAPTION IA
echo =====================================================
echo.
echo A nova versao nao conseguiu ser copiada para:
echo %DEST%
echo.
echo Feche o Premiere e tente novamente.
echo Se necessario, execute este BAT como administrador.
echo.
goto :END_ERROR

:PERMISSION_ERROR
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>&1
cls
echo =====================================================
echo ERRO DE PERMISSAO
echo =====================================================
echo.
echo Nao consegui criar ou alterar a pasta de extensoes da Adobe.
echo.
echo Tente clicar com o botao direito neste arquivo e escolher:
echo "Executar como administrador".
echo.
goto :END_ERROR

:END_OK
echo Pressione qualquer tecla para fechar este instalador.
pause >nul
endlocal
exit /b 0

:END_ERROR
echo Pressione qualquer tecla para fechar este instalador.
pause >nul
endlocal
exit /b 1
