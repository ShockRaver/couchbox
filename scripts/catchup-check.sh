#!/usr/bin/env bash
# Test of terugkijken (Xtream "timeshift") werkt bij jouw provider, en in welk formaat.
# Je wachtwoord wordt verborgen ingevoerd en nergens opgeslagen; in de uitvoer staan gebruikersnaam en wachtwoord gemaskeerd.
# Let op: zet eerst het afspelen op de TV stil (bij 1 verbinding telt elke test als een verbinding).
set -euo pipefail

read -r -p "Server-URL (bv. http://voorbeeld.com:8080): " SERVER
read -r -p "Gebruikersnaam: " USERNAME
read -r -s -p "Wachtwoord (verborgen): " PASSWORD; echo
read -r -p "Zendernaam om te testen (leeg = eerste zender met archief): " CHANNEL
SERVER="${SERVER%/}"

python3 - "$SERVER" "$USERNAME" "$PASSWORD" "$CHANNEL" <<'PY'
import base64, datetime, json, sys, time, urllib.parse, urllib.request
server, user, pw, want = sys.argv[1:5]

def mask(s):
    return s.replace(urllib.parse.quote(pw, safe=''), '***').replace(pw, '***').replace(urllib.parse.quote(user, safe=''), 'USER').replace(user, 'USER')

def api(**q):
    q.update(username=user, password=pw)
    with urllib.request.urlopen(f"{server}/player_api.php?{urllib.parse.urlencode(q)}", timeout=60) as r:
        return json.load(r)

acc = api()
si, ui = acc.get("server_info", {}), acc.get("user_info", {})
print(f"Server-tijdzone : {si.get('timezone')}   servertijd nu: {si.get('time_now')}")
print(f"Verbindingen    : {ui.get('active_cons')} actief van max {ui.get('max_connections')}")

live = api(action="get_live_streams")
arc = [s for s in live if str(s.get("tv_archive")) == "1"]
print(f"Zenders met archief: {len(arc)} van {len(live)}")
if not arc:
    sys.exit("Je provider biedt geen terugkijken aan (geen enkele zender heeft tv_archive).")
if want:
    pick = [s for s in arc if want.lower() in str(s.get("name", "")).lower()]
    if not pick:
        sys.exit(f"Geen zender met archief gevonden met '{want}' in de naam.")
    ch = pick[0]
else:
    ch = arc[0]
sid = ch["stream_id"]
print(f"Test-zender     : {ch.get('name')} (id {sid}, archief {ch.get('tv_archive_duration')} dagen)")

epg = api(action="get_simple_data_table", stream_id=sid).get("epg_listings", [])
now = time.time()
past = [p for p in epg if str(p.get("has_archive")) == "1" and int(p.get("stop_timestamp", 0)) < now - 600]
print(f"EPG-regels      : {len(epg)}, waarvan terug te kijken: {len(past)}")
if not past:
    # Geen has_archive in de EPG: neem een afgelopen programma van ±2 uur geleden
    past = [p for p in epg if now - 4 * 3600 < int(p.get("start_timestamp", 0)) < now - 3600]
    print("  (EPG geeft geen has_archive; ik test een programma van een paar uur geleden)")
if not past:
    sys.exit("Geen geschikt afgelopen programma gevonden in de EPG.")
p = past[-1]
title = base64.b64decode(p.get("title", "")).decode("utf-8", "replace")
st, et = int(p["start_timestamp"]), int(p["stop_timestamp"])
dur = max(1, (et - st) // 60)
print(f"Programma       : {title}  |  EPG 'start' = {p.get('start')}  |  start_timestamp (UTC) = {datetime.datetime.utcfromtimestamp(st)}")

# Starttijden: zoals de EPG ze schrijft (servertijd), in de tijdzone van de server, en in UTC
times = {}
if p.get("start"):
    d, t = p["start"][:10], p["start"][11:16]
    times["EPG-tekst"] = f"{d}:{t.replace(':', '-')}"
try:
    from zoneinfo import ZoneInfo
    if si.get("timezone"):
        times["server-tijdzone"] = datetime.datetime.fromtimestamp(st, ZoneInfo(si["timezone"])).strftime("%Y-%m-%d:%H-%M")
except Exception:
    pass
times["UTC"] = datetime.datetime.utcfromtimestamp(st).strftime("%Y-%m-%d:%H-%M")
times["Mac-lokaal"] = datetime.datetime.fromtimestamp(st).strftime("%Y-%m-%d:%H-%M")

u, pw_q = urllib.parse.quote(user, safe=''), urllib.parse.quote(pw, safe='')
def urls(tm):
    return {
        "timeshift .ts": f"{server}/timeshift/{u}/{pw_q}/{dur}/{tm}/{sid}.ts",
        "timeshift .m3u8": f"{server}/timeshift/{u}/{pw_q}/{dur}/{tm}/{sid}.m3u8",
        "timeshift.php": f"{server}/streaming/timeshift.php?" + urllib.parse.urlencode({"username": user, "password": pw, "stream": sid, "start": tm, "duration": dur}),
    }

def probe(url):
    req = urllib.request.Request(url, headers={"Range": "bytes=0-4095", "User-Agent": "Mozilla/5.0 (SMART-TV; Tizen)"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            body = r.read(4096)
            ctype = r.headers.get("Content-Type", "")
            ok = len(body) > 188 and (body[:1] == b"G" or b"#EXTM3U" in body[:20] or "mpegurl" in ctype or "video" in ctype or "octet" in ctype)
            return ok, f"HTTP {r.status}, {ctype or '?'}, {len(body)} bytes{'' if ok else ' (geen video)'}" + (f", doorgestuurd naar {urllib.parse.urlparse(r.url).netloc}" if r.url != url else "")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} {e.reason}"
    except Exception as e:
        return False, f"fout: {e}"

print("\nResultaten (✓ = levert video):")
seen, good = set(), []
for tname, tm in times.items():
    if tm in seen:
        continue
    seen.add(tm)
    for fname, url in urls(tm).items():
        ok, info = probe(url)
        print(f"  {'✓' if ok else '✗'} {fname:16} tijd={tname:15} ({tm})  {info}")
        if ok:
            good.append((fname, tname))
        time.sleep(1.5)  # provider even tijd geven om de verbinding te sluiten
print("\nConclusie:", ("werkt met " + ", ".join(f"{f} + {t}" for f, t in good)) if good else "geen enkele variant leverde video op.")
PY
