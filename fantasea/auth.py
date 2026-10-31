"""Yahoo OAuth2 session built from .env credentials. Token cached in oauth2.json (gitignored)."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from yahoo_oauth import OAuth2

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT / "oauth2.json"


def get_session() -> OAuth2:
    load_dotenv(ROOT / ".env")
    key, secret = os.getenv("YAHOO_CLIENT_ID"), os.getenv("YAHOO_CLIENT_SECRET")
    if not key or not secret:
        raise SystemExit("Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in .env (see .env.example)")
    if not TOKEN_FILE.exists():
        TOKEN_FILE.write_text(json.dumps({"consumer_key": key, "consumer_secret": secret}))
    sc = OAuth2(None, None, from_file=str(TOKEN_FILE))
    if not sc.token_is_valid():
        sc.refresh_access_token()
    return sc
