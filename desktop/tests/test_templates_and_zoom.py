"""Regression tests: MOGRT metadata, customization and safe independent toggles."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from captionia_desktop.captions import make_subtitles
from captionia_desktop.editor import Word
from captionia_desktop.templates import catalog, read_mogrt, renderer_for


class StylesAndZoomTests(unittest.TestCase):
    def test_embedded_mogrt_catalog_and_style_mapping(self):
        templates = [entry for entry in catalog() if entry.id.startswith("mogrt-")]
        self.assertGreaterEqual(len(templates), 2)
        self.assertEqual({x.renderer for x in templates}, {"word_highlight", "bloco_legenda"})
        self.assertTrue(all(x.preview and x.preview.is_file() for x in templates))
        self.assertTrue(all(not x.exact for x in templates))
        self.assertEqual(renderer_for(templates[0].id), templates[0].renderer)

    def test_mogrt_custom_colors_and_animated_ass_events(self):
        words = [Word(.10, .55, "Legenda"), Word(.60, .95, "colorida")]
        for style in ("word_highlight", "bloco_legenda", "impacto", "caixa"):
            with self.subTest(style=style):
                ass, srt = make_subtitles(words, 1080, 1920, style,
                                          text_color="#33CCFF", highlight_color="#EEAA22",
                                          font_scale=110)
                self.assertIn("&HFFCC33&", ass)
                self.assertIn("&H22AAEE&", ass)
                self.assertIn("Legenda colorida", srt)
                self.assertIn("Dialogue:", ass)
                self.assertNotIn("None", ass)
        self.assertIn("BorderStyle", ass)

    def test_custom_colors_invalid(self):
        with self.assertRaises(ValueError):
            make_subtitles([Word(.1, .5, "Teste")], 1080, 1920,
                           "destaque", highlight_color="expression(code)")
        with self.assertRaises(ValueError):
            make_subtitles([Word(.1, .5, "Teste")], 1080, 1920,
                           "impacto", font_scale=250)

    def test_unrecognized_mogrt_import_is_metadata_only(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "Outro Template.mogrt"
            data = {"capsuleName": "Exemplo animado", "clientControls": [
                {"type": 6, "uiName": {"strDB": [{"localeString": "pt_BR", "str": "Texto principal"}]}}]}
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("definition.json", json.dumps(data))
                archive.writestr("project.aegraphic", b"not executed")
            parsed = read_mogrt(path)
            self.assertEqual(parsed.renderer, "classico")
            self.assertEqual(parsed.origin, "MOGRT · genérico")
            self.assertFalse(parsed.exact)
            self.assertIn("Texto principal", parsed.controls)

    def test_bad_mogrt_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "invalid.mogrt"
            p.write_bytes(b"not a mogrt" * 30)
            with self.assertRaises(ValueError):
                read_mogrt(p)

if __name__ == "__main__":
    unittest.main()
