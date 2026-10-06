#!/usr/bin/env bash
# Haalt alleen de categorienamen (live, films, series) op van je Xtream-server,
# zodat de categorie-indeling op jouw provider afgestemd kan worden.
# Je wachtwoord wordt verborgen ingevoerd en nergens opgeslagen.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/build/categories.txt"
mkdir -p "$(dirname "$OUT")"

read -r -p "Server-URL (bv. http://voorbeeld.com:8080): " SERVER
read -r -p "Gebruikersnaam: " USERNAME
read -r -s -p "Wachtwoord (verborgen): " PASSWORD; echo
SERVER="${SERVER%/}"

python3 - "$SERVER" "$USERNAME" "$PASSWORD" "$OUT" <<'PY'
import json, sys, urllib.parse, urllib.request
server, user, pw, out = sys.argv[1:5]
def get(action):
    q = urllib.parse.urlencode({"username": user, "password": pw, "action": action})
    with urllib.request.urlopen(f"{server}/player_api.php?{q}", timeout=30) as r:
        data = json.load(r)
    return data if isinstance(data, list) else list((data or {}).values())
with open(out, "w") as f:
    for label, action in [("LIVE", "get_live_categories"), ("FILMS", "get_vod_categories"), ("SERIES", "get_series_categories")]:
        cats = get(action)
        f.write(f"== {label} ({len(cats)})\n")
        for c in cats:
            f.write(f"{c.get('category_name', '')}\n")
print(f"Klaar: {out}")
PY
