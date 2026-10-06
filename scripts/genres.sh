#!/usr/bin/env bash
# Telt welke genres je provider per film en per serie meelevert (alleen statistiek, geen titels).
# Je wachtwoord wordt verborgen ingevoerd en nergens opgeslagen.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/build/genres.txt"
mkdir -p "$(dirname "$OUT")"

read -r -p "Server-URL (bv. http://voorbeeld.com:8080): " SERVER
read -r -p "Gebruikersnaam: " USERNAME
read -r -s -p "Wachtwoord (verborgen): " PASSWORD; echo
SERVER="${SERVER%/}"
echo "Bezig met ophalen (kan een minuut duren bij grote catalogi)…"

python3 - "$SERVER" "$USERNAME" "$PASSWORD" "$OUT" <<'PY'
import json, re, sys, urllib.parse, urllib.request
from collections import Counter
server, user, pw, out = sys.argv[1:5]
def get(action):
    q = urllib.parse.urlencode({"username": user, "password": pw, "action": action})
    with urllib.request.urlopen(f"{server}/player_api.php?{q}", timeout=180) as r:
        data = json.load(r)
    return data if isinstance(data, list) else list((data or {}).values())
with open(out, "w") as f:
    for label, action in [("FILMS", "get_vod_streams"), ("SERIES", "get_series")]:
        items = get(action)
        keys = sorted(items[0].keys()) if items else []
        with_genre = [i for i in items if str(i.get("genre") or "").strip()]
        tokens = Counter()
        for i in with_genre:
            for t in re.split(r"\s*[,/|]\s*", str(i["genre"])):
                if t.strip(): tokens[t.strip()] += 1
        years = sum(1 for i in items if re.search(r"(19|20)\d\d", str(i.get("releaseDate") or i.get("release_date") or i.get("year") or "")))
        f.write(f"== {label}: {len(items)} items, {len(with_genre)} met genre ({100*len(with_genre)//max(1,len(items))}%), {years} met jaartal\n")
        f.write("velden: " + ", ".join(keys) + "\n")
        for t, n in tokens.most_common(80):
            f.write(f"{n:7d}  {t}\n")
        f.write("\n")
print(f"Klaar: {out}")
PY
