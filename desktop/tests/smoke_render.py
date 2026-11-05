"""End-to-end non-network smoke with a synthetic AV file and fake API transcript."""
import tempfile
from pathlib import Path
from captionia_desktop.pipeline import run_pipeline
from captionia_desktop.video import ffmpeg_executable, probe_video, run_ffmpeg


class FakeApi:
    def check_license(self):
        pass
    def transcribe(self, audio_file, language):
        return {"words": [
            {"start": .15, "end": .45, "word": "Olá"},
            {"start": .5, "end": .85, "word": "mundo."},
            {"start": 1.15, "end": 1.45, "word": "Teste"},
            {"start": 1.5, "end": 1.85, "word": "final."},
        ]}
    def narrative(self, segments, objective):
        return {"cuts": [{"id": s["id"], "role": "teste"} for s in segments]}


def main():
    with tempfile.TemporaryDirectory() as td:
        folder = Path(td)
        src = folder / "entrada.mp4"
        # Synthetic video is original/test material only; no confidential media involved.
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=0x240B30:s=320x180:r=30:d=2.4",
                    "-f", "lavfi", "-i", "sine=frequency=300:sample_rate=44100:duration=2.4",
                    "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(src)])
        info = probe_video(src)
        assert 2 < info.duration < 3, info
        events = []
        result = run_pipeline(src, folder / "export", FakeApi(), edit_mode="inteligente",
                              output_format="original", caption_style="destaque",
                              status=lambda txt, percent: events.append((txt, percent)))
        assert result.is_file() and result.stat().st_size > 1000
        assert any(p == 100 for _, p in events)
        project = next((folder / "export").glob("*-projeto"))
        assert (project / "legendas.srt").is_file()
        assert (project / "timeline.fcpxml").is_file()
        assert (project / "cortes.csv").is_file()
        print("SMOKE OK", result.name, result.stat().st_size, "bytes; subtitles & project exported")


if __name__ == "__main__":
    main()