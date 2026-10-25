#!/usr/bin/env bash
# Bouwt, signeert en installeert Couchbox op de Samsung TV (Developer Mode).
# Gebruik: scripts/deploy.sh <TV-IP> [certificaatprofiel]
#   bv.   scripts/deploy.sh 192.168.1.50 iptv
# Winkelpakket voor de Samsung Seller Office: scripts/store-package.sh
set -euo pipefail

TV_IP="${1:-${TV_IP:-}}"
PROFILE="${2:-${TIZEN_PROFILE:-iptv}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build/src"
source "$ROOT/scripts/common.sh"

if [ -z "$TV_IP" ]; then echo "Gebruik: $0 <TV-IP> [certificaatprofiel]"; exit 1; fi
need_tizen

# Testresultaat op GitHub voor deze commit: mislukt = niet installeren (toch doen: SKIP_TESTS=1 scripts/deploy.sh …)
check_tests
check_profile "$PROFILE"
prepare_build "$BUILD"

echo "» Verbinden met TV $TV_IP…"
"$SDB" connect "$TV_IP:26101" >/dev/null
SERIAL="$TV_IP:26101"
TARGET="$("$SDB" devices | awk -v s="$SERIAL" '$1 == s && $2 == "device" { print $3 }')"
[ -n "$TARGET" ] || { echo "TV niet verbonden. Staat Developer Mode aan met het IP van deze Mac?"; "$SDB" devices; exit 1; }
echo "  Verbonden: $TARGET"

echo "» Verpakken en signeren met profiel '$PROFILE' (versie $VERSION$DIRTY)…"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$BUILD"
WGT="$(ls "$BUILD"/*.wgt | head -1)"

echo "» Installeren…"
"$TIZEN" install -n "$(basename "$WGT")" -t "$TARGET" -- "$BUILD"

echo "» Starten…"
"$TIZEN" run -p "$APP_ID" -t "$TARGET" || true
echo "Klaar."
