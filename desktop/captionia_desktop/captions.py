"""Readable, bounded ASS captions with optional active-word highlight + SRT export."""
from __future__ import annotations

import re
from pathlib import Path
from .editor import Word


def srt_time(t: float) -> str:
    millis = round(max(t, 0) * 1000)
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"


def ass_time(t: float) -> str:
    centis = round(max(t, 0) * 100)
    h, rest = divmod(centis, 360000)
    m, rest = divmod(rest, 6000)
    s, cs = divmod(rest, 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"


def escape_ass(value: str) -> str:
    return value.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", " ").replace("\r", " ")


def ass_color(rgb: str) -> str:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", rgb):
        raise ValueError("Cor hexadecimal inválida")
    return "&H" + rgb[5:7] + rgb[3:5] + rgb[1:3] + "&"


def caption_groups(words: list[Word], max_words: int = 3,
                   max_chars: int = 26, max_gap: float = 0.55) -> list[list[Word]]:
    result, group = [], []
    for w in words:
        too_long = len(" ".join([v.text for v in group] + [w.text])) > max_chars
        gap = bool(group and w.start - group[-1].end > max_gap)
        if group and (len(group) >= max_words or too_long or gap):
            result.append(group)
            group = []
        group.append(w)
        if len(group) >= 2 and re.search(r"[.!?…]$", w.text):
            result.append(group)
            group = []
    if group:
        result.append(group)
    return result


def _balanced(texts: list[str], max_line: int) -> str:
    if len(" ".join(texts)) <= max_line or len(texts) < 2:
        return " ".join(texts)
    variants = [(" ".join(texts[:i]), " ".join(texts[i:])) for i in range(1, len(texts))]
    a, b = min(variants, key=lambda p: max(len(p[0]), len(p[1])) + abs(len(p[0]) - len(p[1]))*.2)
    return a + "\\N" + b


def make_subtitles(words: list[Word], width: int, height: int,
                   style: str = "destaque", *, text_color: str = "#FFFFFF",
                   highlight_color: str = "#FE398E", font_scale: int = 100) -> tuple[str, str]:
    if style not in ("destaque", "classico", "minimalista", "impacto", "caixa",
                     "word_highlight", "bloco_legenda"):
        raise ValueError("Estilo de legenda inválido.")
    if not 60 <= font_scale <= 140:
        raise ValueError("O tamanho da legenda deve ficar entre 60% e 140%.")
    max_chars = 20 if width < height else 34
    if style in ("impacto", "bloco_legenda"):
        max_chars = int(max_chars * .8)
    groups = caption_groups(words, max_words=2 if style == "bloco_legenda" else 3, max_chars=max_chars)
    # Fixed margins, font bounds, and max 2 rows guard against clipping.
    font_size = max(24, min(65, round(width * (0.052 if width < height else 0.035))))
    margin = max(22, round(width * 0.075))
    bottom = max(35, round(height * (0.16 if width < height else 0.09)))
    normal_color = ass_color(text_color)
    accent_color = ass_color(highlight_color)
    outline = "&H50090912&"
    font_size = int(font_size * font_scale / 100)
    if style == "minimalista":
        font_size = int(font_size * .86)
    if style == "impacto":
        font_size = min(92, int(font_size * 1.07))
    border_style = 3 if style == "caixa" else 1
    outline_size = 1 if style == "caixa" else (2 if style == "minimalista" else 3)
    header = f"""[Script Info]
Title: Caption IA Desktop
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,{font_size},{normal_color},{accent_color},{outline},&H66000000&,-1,0,0,0,100,100,0,0,{border_style},{outline_size},1,2,{margin},{margin},{bottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    srt = []
    for group_index, group in enumerate(groups, 1):
        first, last = group[0].start, group[-1].end
        if last <= first:
            continue
        texts = [escape_ass(w.text) for w in group]
        full_text = " ".join(w.text for w in group)
        srt.append(f"{group_index}\n{srt_time(first)} --> {srt_time(last)}\n{full_text}\n")
        if style in ("destaque", "word_highlight"):
            for i, w in enumerate(group):
                begin = w.start
                end = group[i + 1].start if i + 1 < len(group) else last
                if end - begin < .02:
                    continue
                rendered = []
                for j, word in enumerate(texts):
                    color = accent_color if j == i else normal_color
                    rendered.append("{\\1c" + color + "}" + word)
                # ASS escape affects text, not markup. Use consistent baseline.
                txt = " ".join(rendered)
                if style == "word_highlight":
                    # ASS recreates word emphasis; AE pill shapes/expression timing
                    # are not available in libass and are intentionally not claimed.
                    txt = "{\\fad(45,60)}" + txt
                events.append(f"Dialogue: 0,{ass_time(begin)},{ass_time(end)},Caption,,0,0,0,,{txt}")
        elif style == "bloco_legenda":
            # Approximation of top-down MOGRT: per-word entrance, not AE expression.
            for w in group:
                text = escape_ass(w.text)
                y = height - bottom
                motion = f"{{\\move({width//2},{y-30},{width//2},{y},0,120)\\fad(65,65)}}"
                events.append(f"Dialogue: 0,{ass_time(w.start)},{ass_time(max(w.end,w.start+.07))},Caption,,0,0,0,,{motion}{text}")
        else:
            txt = _balanced(texts, max(12, int(max_chars * .75)))
            if style == "impacto":
                txt = "{\\fscx122\\fscy122\\t(0,160,\\fscx100\\fscy100)\\fad(50,70)}" + txt
            events.append(f"Dialogue: 0,{ass_time(first)},{ass_time(last)},Caption,,0,0,0,,{txt}")
    return header + "\n".join(events) + "\n", "\n".join(srt) + "\n"


def write_subtitles(words: list[Word], folder: Path, w: int, h: int, style: str) -> tuple[Path, Path]:
    ass, srt = make_subtitles(words, w, h, style)
    ass_file = folder / "captions.ass"
    srt_file = folder / "captions.srt"
    ass_file.write_text(ass, encoding="utf-8-sig")
    srt_file.write_text(srt, encoding="utf-8-sig")
    return ass_file, srt_file
