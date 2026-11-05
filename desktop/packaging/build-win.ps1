$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
py -3.12 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt "pyinstaller>=6.13,<7" "pillow>=10,<13"
& .\.venv\Scripts\python.exe assets\build_icons.py
& .\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --windowed --onedir --name CaptionIA-Desktop --icon assets\captionia.ico --collect-binaries imageio_ffmpeg --add-data "captionia_desktop/bundled_mogrts;captionia_desktop/bundled_mogrts" --hidden-import keyring.backends.Windows --hidden-import PySide6.QtMultimediaWidgets main.py
if ($LASTEXITCODE -ne 0) { throw "Falha PyInstaller" }
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (!(Test-Path $iscc)) { throw "Inno Setup 6 não encontrado: instale em https://jrsoftware.org/isinfo.php" }
& $iscc "packaging\CaptionIA-Desktop.iss"
if ($LASTEXITCODE -ne 0) { throw "Falha no instalador Windows" }
Write-Host "Instalador criado em dist_installer\" -ForegroundColor Green
