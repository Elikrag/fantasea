"""Live Yahoo provider. Same interface as MockProvider. Untested until API access is approved."""
from __future__ import annotations

import yahoo_fantasy_api as yfa

from fantasea.auth import get_session

SEASON_YEAR = 2025


class YahooProvider:
    name = "yahoo"

    def __init__(self):
        self.sc = get_session()
        self.gm = yfa.Game(self.sc, "nhl")
        ids = self.gm.league_ids(year=SEASON_YEAR)
        if not ids:
            raise RuntimeError("No NHL leagues found for this account")
        self.lg = self.gm.to_league(ids[0])
        self.settings = self.lg.settings()
        self.cats = [c["display_name"] for c in self.lg.stat_categories()]
        self.team_key = self.lg.team_key()

    def league(self):
        return {"name": self.settings["name"], "week": self.lg.current_week(),
                "season": self.settings.get("season"), "scoring": self.settings.get("scoring_type"),
                "teams": self.settings.get("num_teams"), "cats": self.cats}

    def _player(self, p, stats):
        pos = p["selected_position"]
        s = stats.get(p["player_id"], {})
        return {"id": str(p["player_id"]), "pos": pos, "elig": p["eligible_positions"],
                "name": p["name"], "team": s.get("team", ""), "tonight": None,
                "gp_week": None, "status": p.get("status") or "OK",
                "stats": {k: v for k, v in s.items() if k in self.cats}}

    def team(self):
        tm = self.lg.to_team(self.team_key)
        roster = tm.roster()
        ids = [p["player_id"] for p in roster]
        stats = {s["player_id"]: s for s in self.lg.player_stats(ids, "lastweek")} if ids else {}
        rows = [self._player(p, stats) for p in roster]
        skaters = [r for r in rows if r["pos"] not in ("G", "BN", "IR", "IR+")]
        goalies = [r for r in rows if r["pos"] == "G"]
        bench = [r for r in rows if r["pos"] == "BN"]
        ir = [r for r in rows if r["pos"].startswith("IR")]
        me = next((t for t in self.lg.teams().values() if t["team_key"] == self.team_key), {})
        return {"name": me.get("name", "My team"), "manager": "", "record": "", "rank": None,
                "games_left": None, "active_tonight": None, "slots": len(skaters) + len(goalies),
                "injured": len(ir), "skaters": skaters, "goalies": goalies, "bench": bench, "ir": ir}

    def matchup(self, week=None):
        week = week or self.lg.current_week()
        opp_key = self.lg.to_team(self.team_key).matchup(week)
        teams = self.lg.teams()
        me, opp = teams[self.team_key], teams[opp_key]
        # Category scores live in the scoreboard endpoint; yahoo_fantasy_api exposes raw JSON only.
        raw = self.lg.matchups(week)
        cats = _parse_scoreboard(raw, self.team_key, opp_key, self.cats)
        w = sum(c["result"] == "W" for c in cats); l = sum(c["result"] == "L" for c in cats)
        t = len(cats) - w - l
        return {"week": week, "start": None, "end": None,
                "me": {"name": me["name"], "record": "", "rank": None, "games_left": None},
                "opp": {"name": opp["name"], "record": "", "rank": None, "games_left": None},
                "score": {"w": w, "l": l, "t": t}, "cats": cats, "schedule": []}

    def free_agents(self, pos="ALL", window="lastweek"):
        positions = ["C", "LW", "RW", "D", "G"] if pos == "ALL" else [pos]
        out = []
        for p in positions:
            for fa in self.lg.free_agents(p)[:25]:
                out.append({"id": str(fa["player_id"]), "pos": p, "elig": fa["eligible_positions"],
                            "name": fa["name"], "team": "", "tonight": None, "gp_week": None,
                            "status": fa.get("status") or "OK", "owned": fa.get("percent_owned"),
                            "owned_delta": None, "stats": {}})
        ids = [int(r["id"]) for r in out]
        if ids:
            stats = {s["player_id"]: s for s in self.lg.player_stats(ids[:25], window)}
            for r in out:
                s = stats.get(int(r["id"]), {})
                r["stats"] = {k: v for k, v in s.items() if k in self.cats}
                r["team"] = s.get("team", "")
        return out


def _parse_scoreboard(raw, me_key, opp_key, cat_names):
    """Best-effort walk of Yahoo's nested scoreboard JSON into [{cat, me, opp, result}]."""
    import json
    blob = json.dumps(raw)
    # Fallback: no parse yet. Returns empty until verified against real payload.
    return []
