"""Smoke test: list my NHL leagues, my team, and roster."""
import yahoo_fantasy_api as yfa

from fantasea.auth import get_session


def main() -> None:
    sc = get_session()
    gm = yfa.Game(sc, "nhl")
    league_ids = gm.league_ids(year=2025)
    print("League IDs:", league_ids)
    for lid in league_ids:
        lg = gm.to_league(lid)
        s = lg.settings()
        print(f"\n== {s['name']} ({lid}) | week {lg.current_week()} | scoring={s.get('scoring_type')}")
        for t in lg.teams().values():
            print(f"  {t['team_key']}: {t['name']}")
        tk = lg.team_key()
        print(f"\nMy team: {tk}")
        for p in lg.to_team(tk).roster():
            print(f"  {p['selected_position']:>4}  {p['name']} ({'/'.join(p['eligible_positions'])}) {p['status'] or ''}")


if __name__ == "__main__":
    main()
