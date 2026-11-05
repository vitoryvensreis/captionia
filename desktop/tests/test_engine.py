import tempfile
import unittest
from pathlib import Path

from captionia_desktop.captions import make_subtitles, caption_groups
from captionia_desktop.editor import Word, clean_words, segment_words, select_segments, timeline
from captionia_desktop.pipeline import output_dimensions


class EditingTests(unittest.TestCase):
    def setUp(self):
        self.words = [Word(.1, .5, "Olá"), Word(.55, .9, "mundo."),
                      Word(1.8, 2.1, "Outro"), Word(2.15, 2.55, "trecho.")]

    def test_timeline_rebases_words_and_cuts(self):
        segs = segment_words(self.words)
        self.assertEqual(len(segs), 2)
        selected = select_segments(segs, "inteligente", {"cuts": [{"id": segs[1].id}, {"id": segs[0].id}]})
        edl, words = timeline(selected, 4, "inteligente")
        self.assertAlmostEqual(words[0].start, 0.0)
        self.assertAlmostEqual(words[2].start, edl[1]["dest_start"])
        self.assertLess(edl[0]["dest_start"], edl[1]["dest_start"])

    def test_rejects_untrusted_ai_output(self):
        segs = segment_words(self.words)
        for data in ({"cuts": [{"id": "S9999"}]},
                     {"cuts": [{"id": segs[0].id}, {"id": segs[0].id}]},
                     {"cuts": []}):
            with self.assertRaises(ValueError):
                select_segments(segs, "inteligente", data)

    def test_timestamps_caption_clipping_guards(self):
        ass, srt = make_subtitles(self.words, 1080, 1920, "destaque")
        self.assertIn("PlayResX: 1080", ass)
        self.assertIn("0:00:00.10", ass)
        self.assertIn("00:00:00,100", srt)
        self.assertIn("Olá mundo.", srt)
        self.assertIn("MarginL", ass)
        self.assertNotIn("None", ass)

    def test_words_filter_nonfinite(self):
        out = clean_words([{"word": "a", "start": float("nan"), "end": 1.0},
                           {"word": "ok", "start": 2.0, "end": 2.3}], 5)
        self.assertEqual([x.text for x in out], ["ok"])

    def test_formats(self):
        self.assertEqual(output_dimensions(1921, 1081, "original"), (1920, 1080))
        self.assertEqual(output_dimensions(100, 100, "vertical"), (1080, 1920))


if __name__ == "__main__":
    unittest.main()