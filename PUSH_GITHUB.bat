@echo off
setlocal EnableExtensions
title Caption IA - Publicar no GitHub

where git >nul 2>&1
if errorlevel 1 (
  echo ERRO: Git nao encontrado. Instale o Git for Windows e tente novamente.
  pause
  exit /b 1
)

if not exist ".git\" (
  git init -b main
  if errorlevel 1 goto :erro
  git add -A
  git commit -m "feat: Caption IA v3.1.0"
  if errorlevel 1 goto :erro
)

git branch -M main

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/vitoryvensreis/captionia.git
) else (
  git remote set-url origin https://github.com/vitoryvensreis/captionia.git
)

echo.
echo Enviando Caption IA para github.com/vitoryvensreis/captionia ...
git push -u origin main
if errorlevel 1 goto :erro

echo.
echo Publicacao concluida.
echo https://github.com/vitoryvensreis/captionia
pause
exit /b 0

:erro
echo.
echo Nao foi possivel concluir o push. Verifique o login do GitHub no Git Credential Manager.
pause
exit /b 1
