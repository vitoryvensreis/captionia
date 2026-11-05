"""Deterministic editorial safety guards + word-level timeline remapping."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Word:
    start: float
    end: float
    text: str

    @classmethod
    def parse(cls, value: dict) -> "Word":
        return cls(float(value["start"]), float(value["end"]),
                   str(value.get("word") or value.get("text") or "").strip())


@dataclass
class Segment:
    id: str
    start: float
    end: float
    text: str
    words: list[Word]
    blocked: bool = False
    role: str = "fala"
    reason: str = ""

    def public(self) -> dict:
        return {"id": self.id, "start": round(self.start, 3),
                "end": round(self.end, 3), "text": self.text,
                "blocked": self.blocked}


FALSE_START = re.compile(r"\b(n[ãa]o[,.]? calma|errei|de novo|pera a[ií]|come[cç]a de novo)\b", re.I)
END_SENTENCE = re.compile(r"[.!?…]$", re.U)


def clean_words(words: list[dict], duration: float) -> list[Word]:
    out: list[Word] = []
    for record in words:
        try:
            w = Word.parse(record)
        except (KeyError, ValueError, TypeError, OverflowError):
            continue
        if not w.text or not all(map(math.isfinite, (w.start, w.end))):
            continue
        if w.start < 0 or w.end <= w.start or w.start >= duration + 0.1:
            continue
        out.append(Word(w.start, min(w.end, duration), w.text))
    return sorted(out, key=lambda w: (w.start, w.end))


def segment_words(words: list[Word], *, gap: float = 0.52,
                  max_words: int = 14, max_length: float = 8.0) -> list[Segment]:
    groups: list[list[Word]] = []
    batch: list[Word] = []
    for w in words:
        if batch and (w.start - batch[-1].end > gap or
                      len(batch) >= max_words or w.end - batch[0].start > max_length):
            groups.append(batch)
            batch = []
        batch.append(w)
        if END_SENTENCE.search(w.text) and len(batch) >= 3:
            groups.append(batch)
            batch = []
    if batch:
        groups.append(batch)
    result = []
    for group in groups:
        if group[-1].end - group[0].start < 0.12:
            continue
        text = re.sub(r"\s+([,.;:!?])", r"\1", " ".join(w.text for w in group))
        result.append(Segment(f"S{len(result)+1:04d}", group[0].start,
                              group[-1].end, text, group,
                              bool(FALSE_START.search(text))))
    return result


def select_segments(segments: list[Segment], mode: str, plan: dict | None = None) -> list[Segment]:
    if mode == "completo":
        return segments
    if mode == "silencios":
        # Conservative: no editorial deletion, only gaps removed.
        return segments
    if mode != "inteligente":
        raise ValueError("Modo de edição desconhecido")
    if plan is None:
        raise ValueError("Plano editorial da IA ausente")
    suggestions = plan.get("cuts") or plan.get("selected")
    if not isinstance(suggestions, list) or not suggestions:
        raise ValueError("A IA não retornou seleção de cortes. Nenhum trecho será excluído.")
    by_id = {seg.id: seg for seg in segments}
    seen: set[str] = set()
    output: list[Segment] = []
    for item in suggestions:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError("Corte da IA sem identificador válido.")
        key = item["id"]
        if key not in by_id or key in seen or by_id[key].blocked:
            raise ValueError(f"Plano da IA contém trecho desconhecido, duplicado ou bloqueado: {key}")
        seen.add(key)
        seg = by_id[key]
        seg.role = str(item.get("role") or "fala")[:60]
        seg.reason = str(item.get("reason") or "Selecionado pela IA")[:240]
        output.append(seg)
    return output


def timeline(selected: list[Segment], original_duration: float, mode: str) -> tuple[list[dict], list[Word]]:
    """Create EDL + stable timestamps for subtitles after reordering.

    For uncut mode, preserve source duration and word start times exactly.
    """
    if mode == "completo":
        return ([{"id": "FULL", "source_start": 0.0, "source_end": original_duration,
                  "dest_start": 0.0, "dest_end": original_duration,
                  "role": "vídeo completo"}],
                [w for seg in selected for w in seg.words])
    edl, new_words = [], []
    pos = 0.0
    for seg in selected:
        dur = seg.end - seg.start
        if dur <= 0:
            continue
        edl.append({"id": seg.id, "source_start": round(seg.start, 4),
                    "source_end": round(seg.end, 4), "dest_start": round(pos, 4),
                    "dest_end": round(pos + dur, 4), "role": seg.role,
                    "reason": seg.reason})
        for w in seg.words:
            lo = max(pos, pos + w.start - seg.start)
            hi = min(pos + dur, pos + w.end - seg.start)
            if hi - lo > 0.02:
                new_words.append(Word(lo, hi, w.text))
        pos += dur
    if not edl:
        raise ValueError("Não há intervalos válidos para renderizar.")
    return edl, new_words