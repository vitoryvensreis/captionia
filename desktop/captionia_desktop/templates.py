"""Caption IA style catalog + safe, *metadata-only* reading of Adobe MOGRT archives.

The embedded After Effects projects are NOT executed or rendered; visual styles are
recreated in ASS/libass. Never imply pixel-identical MOGRT rendering outside Adobe.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path

MAX_MOGRT_BYTES = 30 * 1024 * 1024
MAX_DEFINITION_BYTES = 1 * 1024 * 1024
MAX_PREVIEW_BYTES = 3 * 1024 * 1024


@dataclass(frozen=True)
class StyleTemplate:
    id: str
    name: str
    renderer: str
    origin: str = "Nativo"
    description: str = ""
    preview: Path | None = None
    source: Path | None = None
    controls: tuple[str, ...] = ()
    exact: bool = False


BUILTINS: tuple[StyleTemplate, ...] = (
    StyleTemplate("destaque", "Palavra ativa · Rosa", "destaque", description="Destaque por palavra, estilo Caption IA"),
    StyleTemplate("classico", "Clássico · Contorno", "classico", description="Texto branco com contorno"),
    StyleTemplate("minimalista", "Minimalista · Clean", "minimalista", description="Legendas menores, sem exageros"),
    StyleTemplate("impacto", "Impacto · Pop", "impacto", description="Palavras grandes, animadas e com contraste"),
    StyleTemplate("caixa", "Box · Tarja", "caixa", description="Texto sobre fundo de alto contraste"),
)


def packaged_templates_dir() -> Path:
    """PyInstaller --add-data installs package resources under _MEIPASS."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    return base / "captionia_desktop" / "bundled_mogrts"


def user_templates_dir() -> Path:
    return Path.home() / ".captionia_desktop" / "templates"


def _visible_text(entry: object) -> str:
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        db = entry.get("strDB") or []
        if isinstance(db, list) and db:
            return str(db[0].get("str", ""))
    return ""


def _known_renderer(name: str, control_names: tuple[str, ...]) -> str:
    normalized = name.lower()
    controls = {s.lower().strip() for s in control_names}
    if "word_highlight" in normalized or "word_timings" in controls:
        return "word_highlight"
    if "bloco_legenda" in normalized or "top-down" in normalized or "position text 1" in controls:
        return "bloco_legenda"
    return "classico"  # explicit approximation, never an AE render


def read_mogrt(path: Path) -> StyleTemplate:
    path = Path(path)
    if not path.is_file() or path.suffix.lower() != ".mogrt":
        raise ValueError("Selecione um arquivo .mogrt válido.")
    if not 100 <= path.stat().st_size <= MAX_MOGRT_BYTES:
        raise ValueError("MOGRT deve ter até 30 MB para importar metadados.")
    try:
        with zipfile.ZipFile(path) as archive:
            if "definition.json" not in archive.namelist():
                raise ValueError("MOGRT sem definition.json: não é possível identificar o template.")
            meta = archive.getinfo("definition.json")
            if meta.file_size > MAX_DEFINITION_BYTES:
                raise ValueError("Metadados MOGRT excedem o limite seguro.")
            definition = json.loads(archive.read(meta).decode("utf-8-sig"))
            if not isinstance(definition, dict):
                raise ValueError("Metadados do template inválidos.")
            controls = tuple(filter(None, (
                _visible_text(c.get("uiName")) for c in definition.get("clientControls", [])
                if isinstance(c, dict)
            )))[:50]
            capsule = str(definition.get("capsuleName") or path.stem)[:100]
    except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("MOGRT inválido ou danificado.") from exc
    renderer = _known_renderer(path.name + " " + capsule, controls)
    known = renderer in {"word_highlight", "bloco_legenda"}
    preview = path.with_suffix(".png")
    return StyleTemplate(
        id="mogrt-" + hashlib.sha256(path.read_bytes()).hexdigest()[:16],
        name=capsule.replace("_", " ").strip(),
        renderer=renderer,
        origin="MOGRT · adaptação" if known else "MOGRT · genérico",
        description=("Recriação nativa inspirada nos controles do MOGRT; não é render Adobe."
                     if known else "Importação de metadados; visual genérico, NÃO reproduz animação do After Effects."),
        preview=preview if preview.is_file() else None,
        source=path,
        controls=controls,
        exact=False,
    )


def _extract_thumbnail(archive_path: Path, target: Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        if "thumb.png" not in archive.namelist():
            return
        info = archive.getinfo("thumb.png")
        if info.file_size > MAX_PREVIEW_BYTES:
            return
        data = archive.read(info)
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            return
        target.write_bytes(data)


def import_mogrt(path: Path) -> StyleTemplate:
    meta = read_mogrt(path)
    dest_dir = user_templates_dir()
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / (meta.id + ".mogrt")
    if target.resolve() != Path(path).resolve():
        shutil.copyfile(path, target)
    try:
        _extract_thumbnail(target, target.with_suffix(".png"))
    except (OSError, ValueError, zipfile.BadZipFile):
        pass  # template can be imported even without preview
    return read_mogrt(target)


def catalog() -> list[StyleTemplate]:
    found = list(BUILTINS)
    seen = {x.id for x in found}
    for directory in (packaged_templates_dir(), user_templates_dir()):
        for file in sorted(directory.glob("*.mogrt")) if directory.is_dir() else []:
            try:
                item = read_mogrt(file)
                if item.id not in seen:
                    found.append(item)
                    seen.add(item.id)
            except (ValueError, OSError, zipfile.BadZipFile):
                continue
    return found


def renderer_for(template_id: str) -> str:
    for item in catalog():
        if item.id == template_id:
            return item.renderer
    raise ValueError("Template de legenda não encontrado. Se era importado, importe novamente.")
