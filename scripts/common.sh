# Gedeelde stappen voor deploy.sh (TV) en store-package.sh (winkel). Wordt ingelezen met: source scripts/common.sh
# Verwacht: ROOT (projectmap). Zet: TIZEN, SDB, APP_ID, COMMITS, VERSION, STORE_VERSION.

TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
TIZEN="$TIZEN_HOME/tools/ide/bin/tizen"
SDB="$TIZEN_HOME/tools/sdb"
APP_ID="EbIPTVpl01.Kijkdoos"

COMMITS="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 0)"
HASH="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo onbekend)"
DIRTY=""; if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then DIRTY="+"; fi
# Versie in de app: 1.<aantal commits>; in config.xml (Samsung: [0-255].[0-255].[0-65535]): 1.<aantal commits>.0
VERSION="1.$COMMITS"
STORE_VERSION="1.$COMMITS.0"

need_tizen() { [ -x "$TIZEN" ] || { echo "Tizen CLI niet gevonden in $TIZEN_HOME"; exit 1; }; }

# Testresultaat op GitHub voor deze commit. strict=1: alleen doorgaan als de tests geslaagd zijn (winkel)
check_tests() {
    local strict="${1:-}"
    [ -n "${SKIP_TESTS:-}" ] && { echo "» Tests overgeslagen (SKIP_TESTS)"; return; }
    if ! command -v gh >/dev/null 2>&1; then
        [ -n "$strict" ] && { echo "gh (GitHub CLI) niet gevonden; kan de tests niet controleren."; exit 1; }
        return
    fi
    local run
    run="$(cd "$ROOT" && gh run list --workflow test.yml --commit "$(git rev-parse HEAD)" --limit 1 \
        --json status,conclusion --jq 'if length == 0 then "" else .[0] | "\(.status) \(.conclusion)" end' 2>/dev/null || true)"
    case "$run" in
        "completed success") echo "» Tests op GitHub: geslaagd" ;;
        "completed failure"|"completed timed_out")
            echo "De tests op GitHub zijn mislukt voor deze commit. Bekijk ze met: gh run view --web"
            echo "Toch doorgaan: SKIP_TESTS=1 $0"
            exit 1 ;;
        *)
            if [ -n "$strict" ]; then
                echo "Nog geen geslaagde testrun op GitHub voor deze commit (${run:-nog niet gepusht}). Push eerst en wacht tot de tests klaar zijn."
                exit 1
            fi
            [ -z "$run" ] && echo "» Tests op GitHub: nog geen resultaat voor deze commit (nog niet gepusht?)" \
                || echo "» Tests op GitHub: nog bezig of afgebroken ($run), gaat door" ;;
    esac
}

# Controle: Certificate Manager zet soms het author-certificaat in het distributor-vak (TV-fout 118)
check_profile() {
    local profiles="$HOME/tizen-studio-data/profile/profiles.xml" key
    key="$(grep 'distributor="1"' "$profiles" | sed -n 's/.*key="\([^"]*\)".*/\1/p')"
    if [[ "$(basename "${key:-x}")" != distributor*.p12 ]]; then
        echo "Let op: het distributor-certificaat in profiel '$1' wijst naar: $key"
        echo "Dat moet ~/SamsungCertificate/<profiel>/distributor.p12 zijn. Pas $profiles aan en probeer opnieuw."
        exit 1
    fi
}

# Alleen de app-bestanden naar $1 kopiëren en versie, datum en commit erin zetten.
# store=1: zonder eigen TMDB-sleutel (js/config.local.js wordt een leeg bestand)
prepare_build() {
    local dir="$1" store="${2:-}"
    rm -rf "$dir"
    mkdir -p "$dir"
    cp -R "$ROOT/config.xml" "$ROOT/index.html" "$ROOT/icon.png" "$ROOT/css" "$ROOT/js" "$ROOT/img" "$dir/"
    if [ -n "$store" ]; then
        printf "// Winkelversie: geen ingebouwde TMDB-sleutel; gebruikers voeren hun eigen sleutel in (Instellingen → TMDB-gegevens)\n" > "$dir/js/config.local.js"
    fi
    # Te zien in Instellingen → Over deze app; '+' = met niet-gecommitte wijzigingen
    printf "var BUILD = { version: '%s%s', date: '%s', commit: '%s' };\n" "$VERSION" "$DIRTY" "$(date '+%Y-%m-%d %H:%M')" "$HASH" > "$dir/js/build.js"
    # Versie van het pakket (moet bij elke winkel-update hoger zijn)
    sed -i '' "s/<widget \(.*\) version=\"[^\"]*\"/<widget \1 version=\"$STORE_VERSION\"/" "$dir/config.xml"
}
