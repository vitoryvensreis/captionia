"""Local FFmpeg pipeline: source never sent to cloud, only short compressed voice chunks."""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


class VideoError(RuntimeError):
    pass


def ffmpeg_executable() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        path = shutil.which("ffmpeg")
        if path:
            return path
        raise VideoError("FFmpeg não está disponível no aplicativo.") from exc


def run_ffmpeg(args: list[str], cwd: Path | None = None,
               progress: Callable[[float], None] | None = None,
               expected_seconds: float = 0) -> None:
    cmd = [ffmpeg_executable(), "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-stats_period", "0.5"]
    if progress:
        cmd += ["-progress", "pipe:1"]
    cmd += args
    tail: list[str] = []
    proc = subprocess.Popen(cmd, cwd=str(cwd) if cwd else None,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, text=True,
                            encoding="utf-8", errors="replace")
    assert proc.stdout is not None
    try:
        for line in proc.stdout:
            line = line.strip()
            if line:
                tail.append(line)
                if len(tail) > 35:
                    tail.pop(0)
            if progress and expected_seconds > 0 and line.startswith("out_time="):
                val = line.partition("=")[2]
                try:
                    h, m, s = map(float, val.split(":"))
                    progress(max(0.0, min(0.99, (h*3600+m*60+s)/expected_seconds)))
                except ValueError:
                    pass
    finally:
        proc.stdout.close()
    code = proc.wait()
    if code:
        raise VideoError("FFmpeg não conseguiu processar o vídeo:\n" + "\n".join(tail[-12:])[-1600:])
    if progress:
        progress(1.0)


@dataclass(frozen=True)
class VideoInfo:
    duration: float
    width: int
    height: int
    has_audio: bool
    fps: float = 30.0


def probe_video(path: Path) -> VideoInfo:
    if not path.is_file():
        raise VideoError("Selecione um arquivo de vídeo existente.")
    if path.suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}:
        raise VideoError("Formato não reconhecido. Use MP4, MOV, MKV, WEBM ou AVI.")
    proc = subprocess.run([ffmpeg_executable(), "-hide_banner", "-i", str(path)],
                          capture_output=True, text=True, errors="replace", timeout=30)
    text = proc.stdout + proc.stderr
    dur = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", text)
    video = next((line for line in text.splitlines() if "Video:" in line and "Stream #" in line), "")
    if not dur or not video:
        raise VideoError("Não foi possível identificar vídeo e duração neste arquivo.")
    dimensions = re.search(r"(?:^|[\s,])(\d{2,5})x(\d{2,5})(?:[\s,\[,]|)", video)
    if not dimensions:
        dimensions = re.search(r"(\d{2,5})x(\d{2,5})", video)
    if not dimensions:
        raise VideoError("Resolução do vídeo indisponível.")
    sec = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3])
    if sec < .1:
        raise VideoError("Vídeo sem duração válida.")
    fps_m = re.search(r"([\d.]+) fps", video)
    fps = float(fps_m[1]) if fps_m else 30.0
    return VideoInfo(sec, int(dimensions[1]), int(dimensions[2]),
                     any("Audio:" in line and "Stream #" in line for line in text.splitlines()),
                     fps)


def extract_mp3(input_path: Path, start: float, length: float, output: Path) -> None:
    if length <= 0:
        raise VideoError("Trecho de áudio inválido.")
    run_ffmpeg(["-ss", f"{start:.4f}", "-t", f"{length:.4f}", "-i", str(input_path),
                "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
                "-c:a", "libmp3lame", "-b:a", "32k", str(output)])
    if output.stat().st_size > 24_000_000:
        raise VideoError("Trecho de áudio ultrapassa 24 MB. Reduza o tamanho do lote.")


def render_video(input_path: Path, output_path: Path, cuts: list[dict],
                 has_audio: bool, size: tuple[int, int], subtitle_filename: str,
                 cwd: Path, progress: Callable[[float], None] | None = None) -> None:
    if not cuts:
        raise VideoError("Sem cortes para renderização.")
    width, height = size
    if width < 100 or height < 100 or width % 2 or height % 2:
        raise VideoError("Resolução de saída inválida.")
    chains, concat_inputs = [], []
    for i, cut in enumerate(cuts):
        a, b = float(cut["source_start"]), float(cut["source_end"])
        if b <= a:
            raise VideoError("Intervalo inválido no plano de cortes.")
        chains.append(f"[0:v]trim=start={a:.6f}:end={b:.6f},setpts=PTS-STARTPTS,setsar=1[v{i}]")
        concat_inputs.append(f"[v{i}]")
        if has_audio:
            chains.append(f"[0:a:0]atrim=start={a:.6f}:end={b:.6f},asetpts=PTS-STARTPTS[a{i}]")
            concat_inputs.append(f"[a{i}]")
    chains.append("".join(concat_inputs)+f"concat=n={len(cuts)}:v=1:a={1 if has_audio else 0}"+
                  ("[concatv][concata]" if has_audio else "[concatv]"))
    # Always contain within the output canvas; never silently crop the presenter's face.
    vf = (f"[concatv]scale={width}:{height}:force_original_aspect_ratio=decrease,"
          f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x0D0911,"
          f"fps=30,format=yuv420p,ass=filename={subtitle_filename}[rendered]")
    chains.append(vf)
    args = ["-i", str(input_path), "-filter_complex", ";".join(chains),
            "-map", "[rendered]"]
    if has_audio:
        args += ["-map", "[concata]", "-c:a", "aac", "-b:a", "160k"]
    else:
        args += ["-an"]
    args += ["-c:v", "libx264", "-crf", "21", "-preset", "veryfast",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output_path)]
    duration = sum(float(c["source_end"]) - float(c["source_start"]) for c in cuts)
    run_ffmpeg(args, cwd=cwd, progress=progress, expected_seconds=duration)