"""FastAPI app: JSON API + static frontend."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from fantasea.mock import MockProvider

WEB = Path(__file__).resolve().parent.parent / "web"
app = FastAPI(title="fantasea")


@lru_cache
def provider():
    if os.getenv("FANTASEA_MOCK", "1") == "1":
        return MockProvider()
    from fantasea.yahoo import YahooProvider
    return YahooProvider()


@app.get("/api/league")
def league():
    return {"provider": provider().name, **provider().league()}


@app.get("/api/team")
def team():
    return provider().team()


@app.get("/api/matchup")
def matchup(week: int | None = None):
    return provider().matchup(week)


@app.get("/api/free-agents")
def free_agents(pos: str = Query("ALL"), window: str = Query("lastweek")):
    return provider().free_agents(pos.upper(), window)


app.mount("/static", StaticFiles(directory=WEB), name="static")


@app.get("/{path:path}")
def index(path: str):
    return FileResponse(WEB / "index.html")
