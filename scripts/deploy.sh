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

# Testresultaat op GitHub voor deze commit: mislukt = niet installeren (toch doen: SKIP_TESTS=1 scripts/deploy.sh …)
if [ -z "${SKIP_TESTS:-}" ] && command -v gh >/dev/null 2>&1; then
    RUN="$(cd "$ROOT" && gh run list --workflow test.yml --commit "$(git rev-parse HEAD)" --limit 1 \
        --json status,conclusion --jq 'if length == 0 then "" else .[0] | "\(.status) \(.conclusion)" end' 2>/dev/null || true)"
    case "$RUN" in
        "completed success") echo "» Tests op GitHub: geslaagd" ;;
        "completed failure"|"completed timed_out")
            echo "De tests op GitHub zijn mislukt voor deze commit. Bekijk ze met: gh run view --web"
            echo "Toch installeren: SKIP_TESTS=1 $0 $*"
            exit 1 ;;
        "") echo "» Tests op GitHub: nog geen resultaat voor deze commit (nog niet gepusht?)" ;;
        *) echo "» Tests op GitHub: nog bezig of afgebroken ($RUN), installeren gaat door" ;;
    esac
fi

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

# Versie, datum en commit in de app zetten (te zien in Instellingen → Over deze app); '+' = met niet-gecommitte wijzigingen
COMMITS="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 0)"
HASH="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo onbekend)"
DIRTY=""; if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then DIRTY="+"; fi
printf "var BUILD = { version: '1.%s%s', date: '%s', commit: '%s' };\n" "$COMMITS" "$DIRTY" "$(date '+%Y-%m-%d %H:%M')" "$HASH" > "$BUILD/js/build.js"

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
