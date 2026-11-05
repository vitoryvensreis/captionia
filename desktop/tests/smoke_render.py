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
        # Independent toggles: no cuts and no captions must not call Groq at all,
        # while native zoom still produces a valid MP4 and project.
        class NoGroq(FakeApi):
            def transcribe(self, *_):
                raise AssertionError("Transcription should be skipped when both modules are disabled")
            def narrative(self, *_):
                raise AssertionError("Editorial analysis should be skipped")

        zoom_result = run_pipeline(src, folder / "zoom-only", NoGroq(),
                                   edit_mode="completo", enable_captions=False,
                                   zoom_mode="suave", zoom_strength=1.10)
        zoom_project = next((folder / "zoom-only").glob("*-projeto"))
        assert zoom_result.stat().st_size > 1000
        assert not (zoom_project / "legendas.ass").exists()
        assert not (zoom_project / "legendas.srt").exists()
        assert (zoom_project / "projeto.captionia.json").is_file()
        # All modules on, color customization and mapped embedded MOGRT.
        from captionia_desktop.templates import catalog
        template = next(t for t in catalog() if t.renderer == "word_highlight")
        full_result = run_pipeline(src, folder / "all-on", FakeApi(),
                                   edit_mode="inteligente", enable_captions=True,
                                   caption_style=template.id, caption_color="#E6F0FF",
                                   highlight_color="#FFAE42", font_scale=90,
                                   zoom_mode="impacto", zoom_strength=1.06,
                                   zoom_every_cut=True)
        all_project = next((folder / "all-on").glob("*-projeto"))
        import json
        settings = json.loads((all_project / "projeto.captionia.json").read_text())
        assert settings["caption_style"] == template.id
        assert settings["zoom_mode"] == "impacto"
        assert settings["highlight_color"] == "#FFAE42"
        assert full_result.stat().st_size > 1000
        print("SMOKE OK", result.name, "zoom-only and MOGRT template/cuts/subtitles/zoom also rendered")


if __name__ == "__main__":
    main()
