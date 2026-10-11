#!/usr/bin/env bash
# Winkelpakket (.wgt) voor de Samsung TV Seller Office.
# Gebruik: scripts/store-package.sh [certificaatprofiel]      → build/store/kijkdoos-<versie>.wgt (kleine letters, zoals Samsung vraagt)
# - Alleen vanaf een schone, gepushte commit waarvan de tests op GitHub geslaagd zijn
# - Zonder eigen TMDB-sleutel (die zou anders in een openbare app zitten); gebruikers voeren hun eigen sleutel in
# - Versie in config.xml: 1.<aantal commits>.0 (Samsung wil bij elke update een hogere versie)
# - Gesigneerd met hetzelfde Samsung-certificaatprofiel als voor de TV; de Seller Office controleert de handtekening bij uploaden
set -euo pipefail

PROFILE="${1:-${TIZEN_PROFILE:-iptv}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build/store/src"
OUT="$ROOT/build/store"
source "$ROOT/scripts/common.sh"

need_tizen
if [ -n "$DIRTY" ]; then echo "Er zijn niet-gecommitte wijzigingen. Commit en push eerst, zodat het pakket overeenkomt met een commit."; git -C "$ROOT" status --short; exit 1; fi
if [ "$COMMITS" -gt 255 ]; then echo "Versie 1.$COMMITS.0 past niet in Samsungs formaat (max 255): verhoog het eerste cijfer in scripts/common.sh."; exit 1; fi
check_tests strict
check_profile "$PROFILE"
prepare_build "$BUILD" store

# Veiligheid: nergens in het pakket een TMDB-sleutel of andere 32-tekens-sleutel in een toewijzing
if grep -rEq "(tmdbKey|api_key|osKey)[\"']?\s*[:=]\s*[\"'][0-9a-zA-Z]{16,64}[\"']" "$BUILD/js"; then
    echo "STOP: er staat een TMDB- of OpenSubtitles-sleutel in het pakket:"; grep -rEn "(tmdbKey|api_key|osKey)[\"']?\s*[:=]\s*[\"'][0-9a-zA-Z]{16,64}" "$BUILD/js" | cut -c1-120; exit 1
fi

echo "» Verpakken en signeren met profiel '$PROFILE' (versie $STORE_VERSION)…"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$BUILD"
WGT="$(ls "$BUILD"/*.wgt | head -1)"
DEST="$OUT/kijkdoos-$STORE_VERSION.wgt"
mv "$WGT" "$DEST"

# Controle van het pakket: handtekeningen en manifest aanwezig, geen ontwikkelbestanden
LIST="$(unzip -Z1 "$DEST")"
for f in config.xml author-signature.xml signature1.xml index.html icon.png; do
    echo "$LIST" | grep -qx "$f" || { echo "STOP: $f ontbreekt in het pakket"; exit 1; }
done
if echo "$LIST" | grep -Eq "^(tests|scripts|build|\.github)/|README|DESIGN|\.p12$"; then echo "STOP: ontwikkelbestanden in het pakket"; exit 1; fi

echo
echo "Klaar: $DEST"
echo "  versie $STORE_VERSION · $(echo "$LIST" | wc -l | tr -d ' ') bestanden · $(du -h "$DEST" | cut -f1)"
echo "  Upload dit bestand in de Seller Office (Applications → je app → Version → Upload). Zie store/README.md."
