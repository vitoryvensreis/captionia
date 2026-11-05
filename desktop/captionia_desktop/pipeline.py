"""End-to-end: import -> Groq via Caption IA account -> edit -> subtitles -> render."""
from __future__ import annotations

import csv
import json
import math
import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Callable
from xml.etree.ElementTree import Element, SubElement, ElementTree

from .api import CaptionApi
from .captions import make_subtitles
from .templates import renderer_for
from .editor import Word, clean_words, segment_words, select_segments, timeline
from .video import VideoError, extract_mp3, probe_video, render_video

CHUNK_SECONDS = 150.0


def output_dimensions(source_w: int, source_h: int, format_name: str) -> tuple[int, int]:
    if format_name == "vertical":
        return 1080, 1920
    if format_name == "horizontal":
        return 1920, 1080
    if format_name == "original":
        return max(2, source_w - source_w % 2), max(2, source_h - source_h % 2)
    raise ValueError("Formato de vídeo desconhecido")


def make_project_xml(video: Path, width: int, height: int,
                     cuts: list[dict], xml_path: Path) -> None:
    """Best-effort FCPXML exchange timeline (no burned-caption edit controls)."""
    root = Element("fcpxml", version="1.9")
    res = SubElement(root, "resources")
    SubElement(res, "format", id="r1", name="CaptionIA_Format", frameDuration="1/30s",
               width=str(width), height=str(height), colorSpace="1-1-1 (Rec. 709)")
    SubElement(res, "asset", id="r2", name=video.name, src=video.resolve().as_uri(),
               start="0s", hasVideo="1", hasAudio="1")
    lib = SubElement(root, "library")
    event = SubElement(lib, "event", name="Caption IA Desktop")
    project = SubElement(event, "project", name=video.stem + " - Caption IA")
    duration = sum(c["source_end"]-c["source_start"] for c in cuts)
    seq = SubElement(project, "sequence", format="r1", duration=f"{round(duration*30)}/30s",
                     tcStart="0s", tcFormat="NDF", audioLayout="stereo", audioRate="48k")
    spine = SubElement(seq, "spine")
    for i, cut in enumerate(cuts):
        SubElement(spine, "asset-clip", name=f"Corte {i+1:03d}", ref="r2",
                   offset=f"{round(cut['dest_start']*30)}/30s",
                   start=f"{round(cut['source_start']*30)}/30s",
                   duration=f"{max(1,round((cut['source_end']-cut['source_start'])*30))}/30s")
    ElementTree(root).write(xml_path, encoding="utf-8", xml_declaration=True)


def editorial_batches(api: CaptionApi, segments: list, status: Callable[[str, int], None],
                      goal: str) -> list:
    """Never auto-delete on malformed AI output. Reject unknown IDs and duplicate ids."""
    selected = []
    for offset in range(0, len(segments), 65):
        batch = segments[offset:offset + 65]
        status(f"Analisando montagem: lote {1+offset//65} de {math.ceil(len(segments)/65)}", 57)
        response = api.narrative([x.public() for x in batch], goal)
        selected += select_segments(batch, "inteligente", response)
    if not selected:
        raise VideoError("A IA não identificou cortes para a montagem.")
    return selected


def run_pipeline(video: Path, destination: Path, api: CaptionApi, *,
                 edit_mode: str = "inteligente", caption_style: str = "destaque",
                 output_format: str = "original", objective: str = "",
                 enable_captions: bool = True, caption_color: str = "#FFFFFF",
                 highlight_color: str = "#FE398E", font_scale: int = 100,
                 zoom_mode: str = "desligado", zoom_strength: float = 1.10,
                 zoom_every_cut: bool = False,
                 status: Callable[[str, int], None] | None = None) -> Path:
    status = status or (lambda message, percent: None)
    video = Path(video).expanduser().resolve()
    dest = Path(destination).expanduser().resolve()
    info = probe_video(video)
    needs_words = edit_mode != "completo" or enable_captions
    if needs_words and not info.has_audio:
        raise VideoError("Este processamento precisa de áudio com fala para transcrever.")
    if info.duration > 4*3600:
        raise VideoError("Esta versão aceita vídeos de até quatro horas.")
    if edit_mode not in ("completo", "silencios", "inteligente"):
        raise VideoError("Modo de edição não suportado.")
    if zoom_mode not in ("desligado", "suave", "impacto"):
        raise VideoError("Zoom inválido.")
    # Validate all UI inputs before spending credits on transcription.
    from .captions import ass_color
    if enable_captions:
        ass_color(caption_color)
        ass_color(highlight_color)
        if not 60 <= font_scale <= 140:
            raise VideoError("Tamanho da legenda fora do limite de segurança.")
        render_style = renderer_for(caption_style)
    else:
        render_style = ""
    api.check_license()
    size = output_dimensions(info.width, info.height, output_format)
    dest.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    clean_name = re.sub(r"[^0-9A-Za-zÀ-ÿ_-]+", "-", video.stem)[:70].strip("-") or "video"
    basename = f"CaptionIA-{clean_name}-{stamp}"
    # Keep temp work and working directory on the same filesystem for atomic move when possible.
    with tempfile.TemporaryDirectory(prefix="captionia-desktop-") as t:
        tmp = Path(t)
        words: list[Word] = []
        if needs_words:
            chunks = math.ceil(info.duration / CHUNK_SECONDS)
            status("Validando licença e preparando áudio para a transcrição…", 3)
            for index in range(chunks):
                start = index * CHUNK_SECONDS
                end = min(info.duration, start + CHUNK_SECONDS)
                audio = tmp / f"chunk_{index:04d}.mp3"
                status(f"Transcrevendo áudio: parte {index+1}/{chunks}…", 5 + int(index/chunks*45))
                extract_mp3(video, start, end-start, audio)
                data = api.transcribe(audio, "pt")
                audio.unlink(missing_ok=True)
                current = data.get("words")
                if not isinstance(current, list):
                    raise VideoError(f"Transcrição da parte {index+1} não retornou palavras temporizadas.")
                for entry in current:
                    if not isinstance(entry, dict):
                        continue
                    candidate = dict(entry)
                    try:
                        candidate["start"] = float(entry["start"]) + start
                        candidate["end"] = float(entry["end"]) + start
                    except (ValueError, KeyError, TypeError):
                        continue
                    words.append(Word.parse(candidate))
            words = clean_words([{"start": w.start, "end": w.end, "word": w.text} for w in words], info.duration)
            if not words:
                raise VideoError("Nenhuma fala foi reconhecida no vídeo.")
            status("Preparando segmentos a partir das palavras reconhecidas…", 53)
            segments = segment_words(words)
            if edit_mode == "inteligente":
                selected = editorial_batches(api, segments, status, objective)
            else:
                selected = segments
            cuts, final_words = timeline(selected, info.duration, edit_mode)
            if enable_captions and not final_words:
                raise VideoError("Os trechos selecionados não contêm palavras válidas.")
        else:
            # Without cuts and subtitles, skip Groq entirely; optional local
            # zoom still renders and authentication/licensing still apply.
            status("Processando vídeo original sem transcrição…", 55)
            cuts = [{"id": "ORIGINAL", "source_start": 0.0,
                     "source_end": info.duration, "dest_start": 0.0,
                     "dest_end": info.duration, "role": "original", "reason": "sem cortes"}]
            final_words = []
        duration = cuts[-1]["dest_end"]
        if len(cuts) > 200:
            raise VideoError("Há mais de 200 cortes. Divida o vídeo em partes antes de renderizar.")
        if enable_captions:
            status("Gerando legendas e aplicando cores…", 66)
            ass, srt = make_subtitles(final_words, size[0], size[1], render_style,
                                      text_color=caption_color, highlight_color=highlight_color,
                                      font_scale=font_scale)
            (tmp / "captions.ass").write_text(ass, encoding="utf-8-sig")
            (tmp / "captions.srt").write_text(srt, encoding="utf-8-sig")
        status("Renderizando MP4 com cortes e legendas…", 70)
        temp_video = tmp / "video-renderizado.mp4"
        render_video(video, temp_video, cuts, info.has_audio, size,
                     "captions.ass" if enable_captions else None, tmp,
                     progress=lambda value: status("Renderizando vídeo final…", 70 + int(value*25)),
                     zoom_mode=zoom_mode, zoom_strength=zoom_strength,
                     zoom_every_cut=zoom_every_cut)
        if not temp_video.exists() or temp_video.stat().st_size < 1000:
            raise VideoError("O arquivo renderizado ficou vazio.")
        status("Organizando vídeo e arquivos do projeto…", 96)
        project_dir = dest / (basename + "-projeto")
        project_dir.mkdir(parents=True, exist_ok=False)
        mp4_path = dest / (basename + ".mp4")
        try:
            shutil.move(str(temp_video), str(mp4_path))
            if enable_captions:
                shutil.copy2(tmp / "captions.ass", project_dir / "legendas.ass")
                shutil.copy2(tmp / "captions.srt", project_dir / "legendas.srt")
            with (project_dir / "cortes.csv").open("w", newline="", encoding="utf-8-sig") as fh:
                writer = csv.DictWriter(fh, fieldnames=["id", "source_start", "source_end", "dest_start", "dest_end", "role", "reason"], extrasaction="ignore")
                writer.writeheader()
                writer.writerows(cuts)
            project = {
                "app": "Caption IA Desktop", "schema": 1, "video_source": str(video),
                "video_rendered": str(mp4_path), "width": size[0], "height": size[1],
                "source_duration": info.duration, "result_duration": duration,
                "mode": edit_mode, "caption_style": caption_style, "objective": objective,
                "enable_captions": enable_captions, "caption_color": caption_color,
                "highlight_color": highlight_color, "font_scale": font_scale,
                "caption_renderer": render_style if enable_captions else None,
                "mogrt_rendering": "nativo_libass_adaptado_nao_adobe" if caption_style.startswith("mogrt-") else "nativo_libass",
                "zoom_mode": zoom_mode, "zoom_strength": zoom_strength,
                "zoom_every_cut": zoom_every_cut,
                "clips": cuts,
                "transcript": [{"start":round(w.start,3), "end":round(w.end,3), "word":w.text} for w in final_words],
                "note": "Projeto JSON + FCPXML experimental. Estilos MOGRT são adaptações ASS, não renderizações Adobe.",
            }
            (project_dir / "projeto.captionia.json").write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
            make_project_xml(video, size[0], size[1], cuts, project_dir / "timeline.fcpxml")
        except Exception:
            mp4_path.unlink(missing_ok=True)
            raise
        status("Exportação concluída!", 100)
        return mp4_path
