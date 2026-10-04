@echo off
setlocal
title Remover Frame Speed antigo
echo Este utilitario remove somente pastas CEP de usuario com nomes comuns da versao antiga.
echo.
for %%D in (
  "%APPDATA%\Adobe\CEP\extensions\FrameSpeed"
  "%APPDATA%\Adobe\CEP\extensions\Frame Speed"
  "%APPDATA%\Adobe\CEP\extensions\framespeed_2.2"
) do (
  if exist "%%~D" (
    echo Removendo %%~D
    rmdir /S /Q "%%~D"
  )
)
echo Concluido. Se a versao antiga foi instalada em Program Files, remova pelo instalador antigo.
pause
endlocal
