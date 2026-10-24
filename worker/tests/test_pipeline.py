"""End-to-end test of the worker against a real Postgres with the schema and seed loaded.
Uses a fake Claude, so no API key or cost. Skipped when DATABASE_URL is not set."""
import os
import unittest

from app import config, llm

GAME = "2026-10-24-karpat-tappara"


class FakeClaude:
    """Returns what Claude would, including one deliberate mistake (shots)."""

    def call_tool(self, model, system, prompt, tool):
        if tool["name"] == "submit_match_report":
            styles = list(tool["input_schema"]["properties"]["variants"]["properties"]["fi"]["properties"])
            text = {
                "fi": "Kärpät voitti Tapparan jatkoajalla 3–2. Aleksi Mäkelä ratkaisi ajassa 63.41.",
                "sv": "Kärpät slog Tappara med 3–2 efter förlängning. Aleksi Mäkelä avgjorde i 63.41.",
                "en": "Kärpät beat Tappara 3–2 in overtime. Aleksi Mäkelä won it at 63:41, and Tappara outshot them 34–29.",
            }
            return ({
                "headline": {"fi": "Kärpät voitti", "sv": "Kärpät vann", "en": "Kärpät win"},
                "claims": [
                    {"text": "Kärpät won 3–2", "fact_key": "score", "value": "3–2"},
                    {"text": "Mäkelä scored the winner at 63:41", "fact_key": "goal_5", "value": "Aleksi Mäkelä 63:41"},
                    {"text": "Tappara outshot Kärpät 34–29", "fact_key": "shots", "value": "29–34"},
                ],
                "variants": {l: {s: text[l] for s in styles} for l in ("fi", "sv", "en")},
            }, {"input_tokens": 100, "output_tokens": 50})
        if tool["name"] == "submit_podcast_scripts":
            ep = {"title": "Jakso", "lines": [{"host": "A", "text": "Hei ja tervetuloa!"},
                                              {"host": "B", "text": "Kärpät voitti 3–2."}]}
            return ({"fi": ep, "sv": ep, "en": ep}, {"input_tokens": 80, "output_tokens": 40})
        raise AssertionError(tool["name"])


@unittest.skipUnless(os.environ.get("DATABASE_URL"), "needs DATABASE_URL")
class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config.DATABASE_URL = os.environ["DATABASE_URL"]
        config.MEDIA_DIR = "/tmp/finurheilu-test-media"
        llm.set_llm(FakeClaude())

    def test_full_pipeline(self):
        from app import db, highlights, podcast, summary

        sid = summary.run_summary(GAME)
        with db.conn() as c:
            it = c.execute("select status, current_version_id from content_items where id=%s", (sid,)).fetchone()
            self.assertEqual(it["status"], "flagged")  # wrong shots value + stray number 34
            n = c.execute("select count(*) n from summary_variants where version_id=%s", (it["current_version_id"],)).fetchone()["n"]
            self.assertEqual(n, 9)
            checks = [r["check_status"] for r in c.execute(
                "select check_status from claims where version_id=%s order by text", (it["current_version_id"],))]
            self.assertIn("mismatch", checks)

        pid = podcast.run_podcast(GAME)
        with db.conn() as c:
            p = c.execute("select status, depends_on from content_items where id=%s", (pid,)).fetchone()
            self.assertEqual(str(p["depends_on"]), sid)
            eps = c.execute("select count(*) n from podcast_episodes where item_id=%s", (pid,)).fetchone()["n"]
            self.assertEqual(eps, 3)

        hid = highlights.run_highlights(GAME)
        with db.conn() as c:
            v = c.execute("""select v.payload from content_items i join content_versions v on v.id=i.current_version_id
                             where i.id=%s""", (hid,)).fetchone()["payload"]
            self.assertTrue(v["video_url"].endswith(".mp4"))
            path = v["video_url"].split("/media/", 1)[1]
            self.assertGreater(os.path.getsize(os.path.join(config.MEDIA_DIR, path)), 10_000)
            clips = c.execute("select included, label from video_clips where item_id=%s", (hid,)).fetchall()
            self.assertEqual(sum(1 for x in clips if not x["included"]), 1)  # the fight is left out

        # Readers (anon role) must not see any of these drafts.
        with db.conn() as c:
            c.execute("set role anon")
            self.assertEqual(c.execute("select count(*) n from content_items").fetchone()["n"], 0)
            c.execute("reset role")


if __name__ == "__main__":
    unittest.main()
