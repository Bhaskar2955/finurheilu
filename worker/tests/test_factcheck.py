import unittest

from app.factcheck import check_claims, norm, stray_numbers
from app.facts import build_facts, fact_map, game_clock

GAME = {
    "home_id": "karpat", "away_id": "tappara", "home_name": "Kärpät", "away_name": "Tappara",
    "home_score": 3, "away_score": 2, "shots_home": 29, "shots_away": 31, "status": "final",
    "ended_in": "overtime", "venue": "Raksila, Oulu",
    "goalies": [{"team_id": "karpat", "name": "Niklas Lindqvist"}],
    "events": [
        {"id": 1, "type": "goal", "period": 1, "clock": "08:14", "game_seconds": 494, "team_name": "Kärpät",
         "player_name": "Eetu Saarinen", "detail": None, "score_after": "1–0"},
        {"id": 2, "type": "goal", "period": 4, "clock": "03:41", "game_seconds": 3821, "team_name": "Kärpät",
         "player_name": "Aleksi Mäkelä", "detail": "OT winner", "score_after": "3–2"},
    ],
}


class FactTests(unittest.TestCase):
    def setUp(self):
        self.facts = fact_map(build_facts(GAME))

    def test_clock(self):
        self.assertEqual(game_clock(3821), "63:41")

    def test_fact_values(self):
        self.assertEqual(self.facts["score"].value, "3–2")
        self.assertEqual(self.facts["shots"].value, "29–31")
        self.assertEqual(self.facts["winner"].value, "Kärpät")
        self.assertEqual(self.facts["saves_karpat"].value, "29/31")
        self.assertEqual(self.facts["goal_2"].value, "Aleksi Mäkelä 63:41")

    def test_norm_handles_dashes_and_finnish_time(self):
        self.assertEqual(norm("3 - 2"), norm("3–2"))
        self.assertEqual(norm("Aleksi Mäkelä 63.41"), norm("aleksi mäkelä 63:41"))

    def test_claims(self):
        res = check_claims([
            {"text": "Kärpät won 3–2", "fact_key": "score", "value": "3-2"},
            {"text": "Shots 34–29", "fact_key": "shots", "value": "34–29"},
            {"text": "Third straight home win", "fact_key": "streak", "value": "3"},
        ], self.facts)
        self.assertEqual([r.status for r in res], ["ok", "mismatch", "unverified"])
        self.assertEqual(res[1].source_value, "29–31")

    def test_stray_numbers(self):
        self.assertEqual(stray_numbers(["Kärpät won 3–2 at 63.41 with 29 saves"], self.facts), [])
        self.assertEqual(stray_numbers(["Tappara outshot them 34–29 before 5 000 fans"], self.facts), ["34", "5"])


if __name__ == "__main__":
    unittest.main()
