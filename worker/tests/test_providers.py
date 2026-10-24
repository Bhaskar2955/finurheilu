import json
import unittest

from app.demo_ai import DemoWriter
from app.factcheck import check_claims, stray_numbers
from app.facts import build_facts, fact_map
from app.gemini import pick_model, to_gemini_schema
from app.summary import build_prompt, report_tool
from tests.test_factcheck import GAME


class DemoWriterTests(unittest.TestCase):
    def run_demo(self, mistake: bool, instruction=None):
        w = DemoWriter()
        w.mistake = mistake
        facts = build_facts(GAME)
        prompt = build_prompt(GAME, facts, ["quick", "full", "fan"], "Kärpät", None, instruction)
        data, _ = w.call_tool("demo", "", prompt, report_tool(["quick", "full", "fan"]))
        texts = [t for l in data["variants"].values() for t in l.values()]
        return data, texts, fact_map(facts)

    def test_clean_draft_passes_fact_check(self):
        data, texts, fm = self.run_demo(mistake=False)
        self.assertEqual(stray_numbers(texts, fm), [])
        self.assertTrue(all(r.status == "ok" for r in check_claims(data["claims"], fm)))
        self.assertIn("jatkoajalla", data["variants"]["fi"]["quick"])
        self.assertIn("63.41", data["variants"]["fi"]["quick"])

    def test_mistake_is_caught_then_fixed(self):
        data, texts, fm = self.run_demo(mistake=True)
        self.assertIn("mismatch", [r.status for r in check_claims(data["claims"], fm)])
        data, texts, fm = self.run_demo(mistake=True, instruction="Fix the shots")
        self.assertTrue(all(r.status == "ok" for r in check_claims(data["claims"], fm)))
        self.assertEqual(stray_numbers(texts, fm), [])


class GeminiSchemaTests(unittest.TestCase):
    def test_types_upper_case(self):
        s = to_gemini_schema(report_tool(["quick"])["input_schema"])
        self.assertEqual(s["type"], "OBJECT")
        self.assertEqual(s["properties"]["claims"]["items"]["properties"]["text"]["type"], "STRING")
        self.assertNotIn('"object"', json.dumps(s))

    def test_pick_model_prefers_newest_flash(self):
        names = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.8-flash-image"]
        self.assertEqual(pick_model(names), "gemini-3.8-flash")


if __name__ == "__main__":
    unittest.main()
