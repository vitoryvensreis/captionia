$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Version = '3.5.0'
$Source = Join-Path $PSScriptRoot 'CaptionIA'
$Extensions = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$Destination = Join-Path $Extensions 'CaptionIA'
$Local = Join-Path $env:LOCALAPPDATA 'CaptionIA'
$LogDir = Join-Path $Local 'Logs'
$BackupRoot = Join-Path $Local 'Backups'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $BackupRoot ('CaptionIA-antes-' + $Version + '-' + $Timestamp)
$Stage = Join-Path $Extensions ('CaptionIA.stage.' + [guid]::NewGuid().ToString('N'))
$Previous = Join-Path $Extensions ('CaptionIA.previous.' + [guid]::NewGuid().ToString('N'))
$HadPrevious = $false
$Activated = $false
$LogStarted = $false

function Assert-File([string] $File) {
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
        throw "Arquivo obrigatorio ausente: $File"
    }
}
function Info([string] $Message) {
    Write-Host ('[Caption IA] ' + $Message)
}
function Copy-DirectoryContents([string] $From, [string] $Into) {
    New-Item -ItemType Directory -Path $Into -Force | Out-Null
    Get-ChildItem -LiteralPath $From -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Into -Recurse -Force -ErrorAction Stop
    }
}
function Identify-OldPlugin([string] $Dir) {
    $Manifest = Join-Path $Dir 'CSXS\manifest.xml'
    if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { return $false }
    $Name = Split-Path -Leaf $Dir
    $Xml = Get-Content -LiteralPath $Manifest -Raw -ErrorAction Stop
    if ($Xml -match 'com\.editbest\.panel|com\.framespeed\.') { return $true }
    if ($Name -in @('editBest', 'FrameSpeed', 'framespeed') -and $Xml -match 'FrameSpeed|Frame Speed|editBest') { return $true }
    return $false
}

try {
    if (-not $env:APPDATA -or -not $env:LOCALAPPDATA) {
        throw 'Pastas de perfil Windows indisponiveis.'
    }
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Start-Transcript -Path (Join-Path $LogDir ('instalacao-' + $Timestamp + '.log')) -ErrorAction Stop | Out-Null
    $LogStarted = $true
    Info 'Conferindo aplicativos Adobe...'
    $Busy = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -in @('Adobe Premiere Pro','AfterFX','Adobe Media Encoder')
    }
    if ($Busy) {
        throw 'Feche o Premiere, After Effects e Media Encoder antes de instalar.'
    }

    Info 'Validando a pasta extraida...'
    foreach ($Required in @(
        'CSXS\manifest.xml', 'index.html', 'js\main.js',
        'js\cloud_core.js', 'js\cloud_audio_panel.js', 'js\sfx_dual_tracks.js',
        'jsx\hostscript.jsxbin'
    )) { Assert-File (Join-Path $Source $Required) }

    [xml] $Xml = Get-Content -LiteralPath (Join-Path $Source 'CSXS\manifest.xml') -Raw
    $ManifestVersion = [string] $Xml.ExtensionManifest.ExtensionBundleVersion
    if ($ManifestVersion -ne $Version) {
        throw "O manifest informa $ManifestVersion mas este instalador espera $Version. Extraia o ZIP correto."
    }
    if (-not ((Get-Content -LiteralPath (Join-Path $Source 'CSXS\manifest.xml') -Raw) -match 'com\.editbest\.panel')) {
        throw 'ID interno Adobe diferente do Caption IA esperado.'
    }
    New-Item -ItemType Directory -Path $Extensions -Force | Out-Null
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

    Info 'Preparando uma copia da versao 3.5.0...'
    Copy-DirectoryContents $Source $Stage
    foreach ($Required in @('CSXS\manifest.xml', 'index.html', 'jsx\hostscript.jsxbin', 'js\cloud_audio_panel.js')) {
        $A = Join-Path $Source $Required
        $B = Join-Path $Stage $Required
        Assert-File $B
        if ((Get-FileHash -LiteralPath $A -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $B -Algorithm SHA256).Hash) {
            throw "Falha na copia: $Required"
        }
    }

    if (Test-Path -LiteralPath $Destination) {
        Info 'Copiando o plugin antigo para backup seguro...'
        $CurrentBackup = Join-Path $BackupDir 'CaptionIA'
        Copy-DirectoryContents $Destination $CurrentBackup
        Assert-File (Join-Path $CurrentBackup 'CSXS\manifest.xml')
        $HadPrevious = $true
    }

    Info 'Ativando a versao corrigida...'
    if ($HadPrevious) {
        Move-Item -LiteralPath $Destination -Destination $Previous -ErrorAction Stop
    }
    try {
        Move-Item -LiteralPath $Stage -Destination $Destination -ErrorAction Stop
        $Activated = $true
        foreach ($Required in @('CSXS\manifest.xml','jsx\hostscript.jsxbin','js\cloud_audio_panel.js')) {
            Assert-File (Join-Path $Destination $Required)
        }
    }
    catch {
        Info 'A instalacao falhou; restaurando a pasta anterior...'
        if (Test-Path -LiteralPath $Destination) {
            Remove-Item -LiteralPath $Destination -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $Previous) {
            Move-Item -LiteralPath $Previous -Destination $Destination -ErrorAction Stop
        }
        throw
    }

    Info 'Preservando outras instalacoes antigas do mesmo plugin...'
    Get-ChildItem -LiteralPath $Extensions -Directory -ErrorAction Stop | ForEach-Object {
        if ($_.FullName -ne $Destination -and $_.FullName -ne $Previous -and (Identify-OldPlugin $_.FullName)) {
            $Archive = Join-Path $BackupDir ('Legado-' + $_.Name)
            New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
            try { Move-Item -LiteralPath $_.FullName -Destination $Archive -ErrorAction Stop }
            catch { Info ('AVISO: nao consegui arquivar a instalacao duplicada: ' + $_.FullName) }
        }
    }

    Info 'Habilitando extensao CEP sem assinatura para o usuario atual...'
    foreach ($N in @(9,10,11,12,13,14,15)) {
        try {
            $Path = 'HKCU:\Software\Adobe\CSXS.' + $N
            New-Item -Path $Path -Force | Out-Null
            New-ItemProperty -Path $Path -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
        }
        catch { Info ('AVISO: nao foi possivel gravar PlayerDebugMode na versao CSXS ' + $N) }
    }

    if ($HadPrevious -and (Test-Path -LiteralPath $Previous)) {
        Remove-Item -LiteralPath $Previous -Recurse -Force -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $Stage) {
        Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
    }
    Info ('SUCESSO! Caption IA ' + $Version + ' instalado em: ' + $Destination)
    Info ('Backup anterior: ' + $BackupDir)
    Info ('Log: ' + $LogDir)
    Info 'Abra o Premiere > Janela > Extensoes (Legacy) > Caption IA.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
    if (-not $Activated -and (Test-Path -LiteralPath $Previous) -and -not (Test-Path -LiteralPath $Destination)) {
        try { Move-Item -LiteralPath $Previous -Destination $Destination -ErrorAction Stop }
        catch { Write-Host ('ATENCAO: restauracao manual necessaria: ' + $Previous) -ForegroundColor Yellow }
    }
    if (Test-Path -LiteralPath $Stage) {
        try { Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction Stop }
        catch { Write-Host ('ATENCAO: pasta temporaria mantida: ' + $Stage) -ForegroundColor Yellow }
    }
    Write-Host ('Log (se criado): ' + $LogDir)
    exit 1
}
finally {
    if ($LogStarted) { try { Stop-Transcript | Out-Null } catch {} }
}
