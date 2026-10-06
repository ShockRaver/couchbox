#!/usr/bin/env bash
# Bouwt, signeert en installeert Kijkdoos op de Samsung TV (Developer Mode).
# Gebruik: scripts/deploy.sh <TV-IP> [certificaatprofiel]
#   bv.   scripts/deploy.sh 192.168.1.50 iptv
set -euo pipefail

TV_IP="${1:-${TV_IP:-}}"
PROFILE="${2:-${TIZEN_PROFILE:-iptv}}"
TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
TIZEN="$TIZEN_HOME/tools/ide/bin/tizen"
SDB="$TIZEN_HOME/tools/sdb"
APP_ID="EbIPTVpl01.Kijkdoos"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build/src"

if [ -z "$TV_IP" ]; then echo "Gebruik: $0 <TV-IP> [certificaatprofiel]"; exit 1; fi
[ -x "$TIZEN" ] || { echo "Tizen CLI niet gevonden in $TIZEN_HOME"; exit 1; }

# Controle: Certificate Manager zet soms het author-certificaat in het distributor-vak (TV-fout 118)
PROFILES="$HOME/tizen-studio-data/profile/profiles.xml"
DIST_KEY="$(grep 'distributor="1"' "$PROFILES" | sed -n 's/.*key="\([^"]*\)".*/\1/p')"
if [[ "$(basename "${DIST_KEY:-x}")" != distributor*.p12 ]]; then
    echo "Let op: het distributor-certificaat in profiel '$PROFILE' wijst naar: $DIST_KEY"
    echo "Dat moet ~/SamsungCertificate/<profiel>/distributor.p12 zijn. Pas $PROFILES aan en probeer opnieuw."
    exit 1
fi

# Alleen de app-bestanden verpakken (geen scripts/README/build)
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -R "$ROOT/config.xml" "$ROOT/index.html" "$ROOT/icon.png" "$ROOT/css" "$ROOT/js" "$BUILD/"

echo "» Verbinden met TV $TV_IP…"
"$SDB" connect "$TV_IP:26101" >/dev/null
SERIAL="$TV_IP:26101"
TARGET="$("$SDB" devices | awk -v s="$SERIAL" '$1 == s && $2 == "device" { print $3 }')"
[ -n "$TARGET" ] || { echo "TV niet verbonden. Staat Developer Mode aan met het IP van deze Mac?"; "$SDB" devices; exit 1; }
echo "  Verbonden: $TARGET"

echo "» Verpakken en signeren met profiel '$PROFILE'…"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$BUILD"
WGT="$(ls "$BUILD"/*.wgt | head -1)"

echo "» Installeren…"
"$TIZEN" install -n "$(basename "$WGT")" -t "$TARGET" -- "$BUILD"

echo "» Starten…"
"$TIZEN" run -p "$APP_ID" -t "$TARGET" || true
echo "Klaar."
