$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$src = Join-Path $root 'CaptionIA'
$backup = Join-Path $env:LOCALAPPDATA ("CaptionIA\backups\montagem-beta-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$paths = @('js\autoedit.js','js\narrative-beta.js','jsx\narrative-beta.jsx','css\narrative-beta.css')
Write-Host "=== CAPTION IA | MONTAGEM INTELIGENTE BETA ===" -ForegroundColor Yellow
Write-Host "Nao apaga suas configuracoes ou substitui o hostscript compilado." -ForegroundColor Gray
if (Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -like 'Adobe Premiere*'}) { throw 'Feche o Premiere Pro antes de instalar.' }
if (-not (Test-Path $src)) {throw 'Pacote sem pasta CaptionIA.'}
$existing = @()
if (Test-Path $base) {
  Get-ChildItem $base -Directory | ForEach-Object {
    $m=Join-Path $_.FullName 'CSXS\manifest.xml'
    if ((Test-Path $m) -and ((Get-Content $m -Raw) -match 'com\.editbest\.panel')) {$existing += $_.FullName}
  }
}
if ($existing.Count -gt 1) { throw "Encontradas multiplas instalacoes do Caption IA: $($existing -join ', '). Corrija a duplicidade antes de instalar." }
if ($existing.Count -eq 0) {
  Write-Host 'Nao encontrei uma instalacao atual do Caption IA.' -ForegroundColor Yellow
  Write-Host 'Posso instalar a base COMPLETA 3.4.0 que acompanha este ZIP, mas nao sera a 3.4.6 do GitHub.' -ForegroundColor Yellow
  $c=Read-Host 'Digite INSTALAR para confirmar, ou Enter para cancelar'
  if ($c -cne 'INSTALAR') {throw 'Instalacao cancelada.'}
  New-Item -ItemType Directory -Force $base | Out-Null
  $dest=Join-Path $base 'CaptionIA'
  if (Test-Path $dest) {throw 'Pasta de destino ja existe; remova a duplicidade primeiro.'}
  Copy-Item -Recurse $src $dest
  Write-Host "Base completa instalada: $dest" -ForegroundColor Green
} else {
  $dest=$existing[0]
  Write-Host "Aplicando BETA sobre a instalacao existente: $dest" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force $backup | Out-Null
  foreach($p in $paths) {
    $from=Join-Path $src $p; $to=Join-Path $dest $p
    if (!(Test-Path $from)) {throw "Arquivo ausente no pacote: $p"}
    if (Test-Path $to) {
      $b=Join-Path $backup $p;New-Item -ItemType Directory -Force (Split-Path $b -Parent) | Out-Null
      Copy-Item -Force $to $b
    }
  }
  try {
    foreach($p in $paths) {
      $to=Join-Path $dest $p;New-Item -ItemType Directory -Force (Split-Path $to -Parent) | Out-Null
      Copy-Item -Force (Join-Path $src $p) $to
    }
  } catch {
    foreach($p in $paths) { $old=Join-Path $backup $p; if (Test-Path $old) {Copy-Item -Force $old (Join-Path $dest $p)} }
    throw "Instalacao revertida apos falha: $_"
  }
  Write-Host "Backup da versao anterior: $backup" -ForegroundColor Cyan
}
Write-Host 'Instalado. Abra Premiere > Janela > Extensoes (legado) > Caption IA.' -ForegroundColor Green
Write-Host 'Auto Edit > ative Montagem inteligente IA > Rodar Auto Edit.' -ForegroundColor Green
Write-Host 'A BETA limita-se a uma faixa V1 e audio vinculado em A1.' -ForegroundColor Yellow
Write-Host 'Atualizacoes oficiais futuras podem substituir este patch experimental.' -ForegroundColor Yellow