#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON="${PYTHON:-python3}"
"$PYTHON" -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt 'pyinstaller>=6.13,<7' 'pillow>=10,<13'
python assets/build_icons.py
mkdir -p build/icons/captionia.iconset
for size in 16 32 64 128 256 512; do
  sips -z "$size" "$size" assets/captionia.png --out "build/icons/captionia.iconset/icon_${size}x${size}.png" >/dev/null
  twice=$((size * 2))
  sips -z "$twice" "$twice" assets/captionia.png --out "build/icons/captionia.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns build/icons/captionia.iconset -o build/icons/captionia.icns
python -m PyInstaller --noconfirm --clean --windowed --onedir --name CaptionIA-Desktop --icon build/icons/captionia.icns --collect-binaries imageio_ffmpeg --add-data "captionia_desktop/bundled_mogrts:captionia_desktop/bundled_mogrts" --hidden-import keyring.backends.macOS --hidden-import PySide6.QtMultimediaWidgets main.py
# Ad-hoc local signature is not Apple notarization; Gatekeeper approval may be required.
codesign --force --deep --sign - dist/CaptionIA-Desktop.app
mkdir -p dist_installer build/dmg-content
rm -rf build/dmg-content/CaptionIA-Desktop.app
cp -R dist/CaptionIA-Desktop.app build/dmg-content/CaptionIA-Desktop.app
ln -sfn /Applications build/dmg-content/Applications
hdiutil create -volname "Caption IA Desktop" -srcfolder build/dmg-content -ov -format UDZO "dist_installer/CaptionIA-Desktop-macOS-1.1.0-$(uname -m).dmg"
echo "Instalador criado em dist_installer/"
