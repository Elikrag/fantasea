"""Mock data provider. Same interface as YahooProvider; used until API access is approved."""
from __future__ import annotations

import random
from datetime import date, timedelta

random.seed(7)

CATS = ["G", "A", "P", "+/-", "PIM", "PPP", "SOG", "HIT", "W", "GAA", "SV%"]
LOWER_IS_BETTER = {"GAA"}

SKATERS = [
    ("C", "Auston Matthews", "TOR"), ("C", "Connor McDavid", "EDM"),
    ("LW", "Nathan MacKinnon", "COL"), ("LW", "Artemi Panarin", "NYR"),
    ("RW", "Matthew Tkachuk", "FLA"), ("RW", "Jason Robertson", "DAL"),
    ("D", "Quinn Hughes", "VAN"), ("D", "Victor Hedman", "TBL"),
    ("D", "Jaccob Slavin", "CAR"), ("D", "Brock Faber", "MIN"),
]
GOALIES = [("G", "Connor Hellebuyck", "WPG"), ("G", "Jeremy Swayman", "BOS")]
BENCH = [("C", "Dylan Cozens", "BUF"), ("LW", "Alex Tuch", "BUF"), ("D", "Shea Theodore", "VGK")]
IR = [("RW", "Patrik Laine", "MTL")]
OPP = ["BOS", "VGK", "NJD", "CHI", "SEA", "PIT", "WPG", "MIN", "TOR", "LAK"]


def _skater_line(pos, name, team, i, status="OK", slot=None):
    tonight = random.random() > 0.3
    return {
        "id": f"p{i}", "pos": slot or pos, "elig": [pos], "name": name, "team": team,
        "tonight": f"vs {random.choice(OPP)}" if tonight else None,
        "gp_week": random.randint(2, 4), "status": status,
        "stats": {"G": random.randint(0, 3), "A": random.randint(0, 4), "P": 0,
                  "+/-": random.randint(-3, 5), "PPP": random.randint(0, 3),
                  "SOG": random.randint(4, 16), "HIT": random.randint(0, 9)},
    }


def _goalie_line(pos, name, team, i, slot=None):
    tonight = random.random() > 0.4
    return {
        "id": f"g{i}", "pos": slot or pos, "elig": ["G"], "name": name, "team": team,
        "tonight": f"vs {random.choice(OPP)}" if tonight else None,
        "gp_week": random.randint(1, 3), "status": "OK",
        "start": random.choice(["Confirmed", "Probable", "Unlikely"]) if tonight else None,
        "stats": {"W": random.randint(0, 2), "GAA": round(random.uniform(1.9, 3.4), 2),
                  "SV%": round(random.uniform(0.885, 0.940), 3), "SO": random.randint(0, 1)},
    }


class MockProvider:
    name = "mock"

    def league(self):
        return {"name": "Frozen Assets League", "week": 4, "season": "2025-26",
                "scoring": "head-to-head categories", "teams": 12, "cats": CATS}

    def team(self):
        skaters = [_skater_line(*s, i) for i, s in enumerate(SKATERS)]
        for p in skaters:
            p["stats"]["P"] = p["stats"]["G"] + p["stats"]["A"]
        goalies = [_goalie_line(*g, i) for i, g in enumerate(GOALIES)]
        bench = [_skater_line(*b, 100 + i, slot="BN") for i, b in enumerate(BENCH)]
        ir = [_skater_line(*b, 200 + i, status="IR", slot="IR") for i, b in enumerate(IR)]
        for p in bench + ir:
            p["stats"]["P"] = p["stats"]["G"] + p["stats"]["A"]
        return {
            "name": "Skrag Puck Dynasty", "manager": "Eli", "record": "3-1-0", "rank": 2,
            "games_left": sum(p["gp_week"] for p in skaters + goalies),
            "active_tonight": sum(1 for p in skaters + goalies if p["tonight"]),
            "slots": len(skaters) + len(goalies),
            "injured": len(ir) + sum(1 for p in skaters if p["status"] != "OK"),
            "skaters": skaters, "goalies": goalies, "bench": bench, "ir": ir,
        }

    def matchup(self, week: int | None = None):
        week = week or 4
        me = {"G": 12, "A": 18, "P": 30, "+/-": 7, "PIM": 22, "PPP": 9, "SOG": 118, "HIT": 88,
              "W": 4, "GAA": 2.41, "SV%": 0.912}
        opp = {"G": 9, "A": 21, "P": 30, "+/-": 2, "PIM": 24, "PPP": 5, "SOG": 104, "HIT": 97,
               "W": 3, "GAA": 2.85, "SV%": 0.914}
        cats = []
        w = l = t = 0
        for c in CATS:
            a, b = me[c], opp[c]
            if a == b:
                res = "T"; t += 1
            else:
                win = a < b if c in LOWER_IS_BETTER else a > b
                res = "W" if win else "L"
                w += win; l += not win
            cats.append({"cat": c, "me": a, "opp": b, "result": res})
        start = date(2025, 10, 27) + timedelta(weeks=week - 4)
        days = [(start + timedelta(d)).strftime("%a") for d in range(7)]
        return {
            "week": week, "start": start.isoformat(), "end": (start + timedelta(6)).isoformat(),
            "me": {"name": "Skrag Puck Dynasty", "record": "3-1-0", "rank": 2, "games_left": 31},
            "opp": {"name": "Hat Trick Hooligans", "record": "2-2-0", "rank": 6, "games_left": 28},
            "score": {"w": w, "l": l, "t": t},
            "cats": cats,
            "schedule": [{"day": d, "me": random.randint(2, 7), "opp": random.randint(2, 7)} for d in days],
        }

    def free_agents(self, pos: str = "ALL", window: str = "lastweek"):
        pool = [
            ("C", "Tim Stützle", "OTT"), ("LW", "Jonathan Huberdeau", "CGY"), ("D", "Travis Sanheim", "PHI"),
            ("RW", "Jordan Kyrou", "STL"), ("C", "Logan Cooley", "UTA"), ("D", "Simon Edvinsson", "DET"),
            ("LW", "Kirill Marchenko", "CBJ"), ("G", "Joey Daccord", "SEA"), ("RW", "Jesper Bratt", "NJD"),
            ("C", "Dylan Strome", "WSH"), ("D", "Brandt Clarke", "LAK"), ("LW", "Tyler Bertuzzi", "CHI"),
            ("C", "Mason McTavish", "ANA"), ("D", "Owen Power", "BUF"), ("RW", "Matt Boldy", "MIN"),
            ("G", "Lukas Dostal", "ANA"),
        ]
        rows = []
        for i, (p, n, t) in enumerate(pool):
            if pos != "ALL" and p != pos:
                continue
            row = _goalie_line(p, n, t, 300 + i) if p == "G" else _skater_line(p, n, t, 300 + i)
            if p != "G":
                row["stats"]["P"] = row["stats"]["G"] + row["stats"]["A"]
            row["owned"] = random.randint(5, 45)
            row["owned_delta"] = random.randint(-4, 14)
            rows.append(row)
        rows.sort(key=lambda r: -(r["stats"].get("P", 0) + r["stats"].get("W", 0) * 3))
        return rows
