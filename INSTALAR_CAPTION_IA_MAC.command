#!/bin/bash

# Caption IA - Instalador para macOS
# Instala na pasta CEP do usuario, sem precisar de sudo.
# Se encontrar Caption IA/editBest/FrameSpeed antigo, remove e substitui.
# Se nao encontrar versao antiga, apenas instala a nova.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/CaptionIA"
BASE="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$BASE/CaptionIA"
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/captionia_install.XXXXXX")"
STAGE="$STAGE_ROOT/CaptionIA"
BACKUP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/captionia_backup.XXXXXX")"
INSTALL_OK=0
BACKUP_USED=0

OLD_NAMES=("CaptionIA" "editBest" "FrameSpeed" "framespeed")

cleanup() {
    rm -rf "$STAGE_ROOT" >/dev/null 2>&1 || true
    if [ "$INSTALL_OK" -eq 1 ]; then
        rm -rf "$BACKUP_ROOT" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

wait_key() {
    echo
    read -r -n 1 -p "Pressione qualquer tecla para fechar..." _ 2>/dev/null || read -r _
    echo
}

fail() {
    echo
    echo "====================================================="
    echo "ERRO: $1"
    echo "====================================================="
    [ -n "${2:-}" ] && echo "$2"
    echo
    wait_key
    exit 1
}

restore_backup() {
    if [ "$BACKUP_USED" -eq 0 ]; then
        return
    fi
    echo "Restaurando a instalacao anterior..."
    rm -rf "$DEST" >/dev/null 2>&1 || true
    for name in "${OLD_NAMES[@]}"; do
        if [ -e "$BACKUP_ROOT/$name" ]; then
            mv "$BACKUP_ROOT/$name" "$BASE/$name" >/dev/null 2>&1 || true
        fi
    done
}

clear
printf '%s\n' "====================================================="
printf '%s\n' "             CAPTION IA - INSTALADOR MAC"
printf '%s\n' "====================================================="
echo
echo "Este instalador remove a versao antiga, se existir,"
echo "e instala a nova versao do Caption IA."
echo
echo "Se nao houver versao antiga, ele apenas instala."
echo
echo "IMPORTANTE: feche o Adobe Premiere Pro antes de continuar."
echo

if [ "$(uname -s)" != "Darwin" ]; then
    fail "Este instalador foi feito para macOS."
fi

if pgrep -f "Adobe Premiere Pro" >/dev/null 2>&1; then
    echo "AVISO: o Adobe Premiere Pro parece estar aberto."
    echo "Feche o Premiere antes de continuar para evitar cache da extensao."
    echo
fi

read -r -p "Pressione Enter para continuar..." _

# 1) Validar o pacote novo antes de tocar na instalacao atual.
[ -f "$SRC/CSXS/manifest.xml" ] || fail "A pasta CaptionIA nao foi encontrada ao lado deste instalador." "Extraia o ZIP COMPLETO antes de executar o arquivo .command."
[ -f "$SRC/index.html" ] || fail "O pacote CaptionIA esta incompleto." "Arquivo ausente: CaptionIA/index.html"
[ -f "$SRC/js/main.js" ] || fail "O pacote CaptionIA esta incompleto." "Arquivo ausente: CaptionIA/js/main.js"

grep -qi "Caption IA" "$SRC/CSXS/manifest.xml" || fail "O manifest.xml nao parece ser do Caption IA."

mkdir -p "$BASE" || fail "Nao consegui criar a pasta de extensoes da Adobe." "$BASE"

echo
echo "[1/5] Preparando a nova versao..."
if ! ditto "$SRC" "$STAGE"; then
    fail "Nao consegui preparar a nova versao." "Nenhuma instalacao antiga foi removida."
fi

[ -f "$STAGE/CSXS/manifest.xml" ] || fail "A copia temporaria ficou incompleta." "Nenhuma instalacao antiga foi removida."
[ -f "$STAGE/index.html" ] || fail "A copia temporaria ficou incompleta." "Nenhuma instalacao antiga foi removida."
[ -f "$STAGE/js/main.js" ] || fail "A copia temporaria ficou incompleta." "Nenhuma instalacao antiga foi removida."

echo "[2/5] Verificando instalacoes antigas..."
for name in "${OLD_NAMES[@]}"; do
    OLD_PATH="$BASE/$name"
    if [ -e "$OLD_PATH" ]; then
        echo "      Encontrado: $name"
        if ! mv "$OLD_PATH" "$BACKUP_ROOT/$name"; then
            restore_backup
            fail "Nao consegui remover a versao antiga '$name'." "Feche o Premiere e tente novamente."
        fi
        BACKUP_USED=1
    fi
done

if [ "$BACKUP_USED" -eq 0 ]; then
    echo "      Nenhuma versao antiga encontrada. Prosseguindo com instalacao limpa."
else
    echo "      Versao antiga separada com seguranca para substituicao."
fi

echo "[3/5] Instalando o Caption IA..."
if ! ditto "$STAGE" "$DEST"; then
    restore_backup
    fail "A instalacao da nova versao falhou." "A versao anterior foi restaurada quando possivel."
fi

if [ ! -f "$DEST/CSXS/manifest.xml" ] || [ ! -f "$DEST/index.html" ] || [ ! -f "$DEST/js/main.js" ]; then
    restore_backup
    fail "A instalacao ficou incompleta." "A versao anterior foi restaurada quando possivel."
fi

# Remove o atributo de quarentena do pacote baixado, quando existir.
xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1 || true

# Permissoes de leitura/execucao adequadas ao CEP.
chmod -R u+rwX,go+rX "$DEST" >/dev/null 2>&1 || true

echo "[4/5] Ativando extensoes CEP no Adobe..."
for version in 9 10 11 12 13 14 15 16 17; do
    defaults write "com.adobe.CSXS.$version" PlayerDebugMode 1 >/dev/null 2>&1 || true
done

echo "[5/5] Finalizando..."
INSTALL_OK=1
rm -rf "$BACKUP_ROOT" >/dev/null 2>&1 || true
BACKUP_USED=0

echo
echo "====================================================="
echo "       CAPTION IA INSTALADO COM SUCESSO"
echo "====================================================="
echo
echo "Instalado em:"
echo "$DEST"
echo
echo "Se nao havia versao antiga, nenhuma remocao foi feita."
echo "O instalador apenas colocou a nova versao."
echo
echo "Os dados do usuario e a chave da API nao sao apagados."
echo "Somente a pasta da extensao CEP e substituida."
echo
echo "Agora abra novamente o Adobe Premiere Pro e procure por:"
echo "Janela > Extensoes > Caption IA"
echo
echo "Se o macOS bloquear o arquivo na primeira abertura:"
echo "Ajustes do Sistema > Privacidade e Seguranca > Abrir Mesmo Assim"
echo
wait_key
exit 0
