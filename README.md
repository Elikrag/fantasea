# fantasea

Personal, read-only, non-commercial tool for pulling my own Yahoo Fantasy Hockey league data
(rosters, matchups, players) via the official Yahoo Fantasy Sports API.

- Single user, single league, self-hosted. Not distributed.
- Fantasy data provided by Yahoo Fantasy.

## Run

```bash
cp .env.example .env   # fill in CLIENT_ID / CLIENT_SECRET
uv run python -m fantasea.smoke          # one-time OAuth; caches oauth2.json
uv run uvicorn fantasea.server:app --reload
```

Open http://localhost:8000. Mock data is on by default; set `FANTASEA_MOCK=0` for live Yahoo data.
