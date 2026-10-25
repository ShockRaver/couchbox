# Couchbox in de Samsung-winkel (TV Seller Office)

## 1. Pakket maken

```bash
scripts/store-package.sh iptv
```

- Alleen vanaf een schone, gepushte commit waarvan de tests op GitHub geslaagd zijn.
- Resultaat: `build/store/couchbox-<versie>.wgt`, verpakt en gesigneerd met de Tizen Studio-CLI en het Samsung-certificaatprofiel `iptv`.
- Zonder ingebouwde TMDB-sleutel; het script stopt als er toch een sleutel in het pakket zit.
- Versie in `config.xml`: `1.<aantal commits>.0`. Die moet bij elke update hoger zijn, dus commit iets voor een nieuwe versie.

## 2. Winkeltekst

**Categorie:** Video (of Entertainment)

**Tags:** IPTV player, IPTV, TV guide, EPG, XMLTV, live TV, video player, media player, M3U8, HLS
Niet gebruiken: free, movies, channels, sports, Netflix, namen van zenders of providers, "Xtream Codes".

### English

**Short description:** Player for your own IPTV subscription, with live TV, a full TV guide, movies and series. No content included.

**Description:**

> Couchbox is a player for the IPTV subscription you already have. Sign in with the server address, username and password from your provider and watch it in a clean, fast interface made for the TV remote.
>
> IMPORTANT: Couchbox does not contain or provide any channels, movies or series. You need your own subscription from a provider. We do not endorse streaming copyrighted content without permission from the rights holder.
>
> LIVE TV & TV GUIDE
> • Channel list with now/next info and a preview window
> • TV guide grid several days ahead, with reminders
> • Use your provider's guide or any XMLTV guide (also .gz)
> • Hide channels and groups, reorder them, make your own channel lists
> • Number keys, channel up/down and previous channel
>
> MOVIES & SERIES
> • Rows per genre, ordered by release year, rating and popularity
> • Continue watching, My list and alerts for new episodes
> • Remembers audio and subtitle choices per series
> • Next episode: automatic, ask, or off
>
> SEARCH & RECOMMENDATIONS
> • Search that handles typos, and finds actors and directors
> • Personal recommendations based on what you watch
>
> MORE
> • 9 languages: English, Dutch, German, French, Spanish, Greek, Italian, Polish, Turkish
> • Multiple profiles, PIN lock for settings, option to hide 18+ categories
> • Optional: posters, descriptions and genres via your own free TMDB key
>
> This product uses the TMDB API but is not endorsed or certified by TMDB.

### Nederlands

**Korte beschrijving:** Speler voor je eigen IPTV-abonnement, met live tv, een volledige tv-gids, films en series. Bevat geen content.

**Beschrijving:**

> Couchbox is een speler voor het IPTV-abonnement dat je al hebt. Log in met het serveradres, de gebruikersnaam en het wachtwoord van je provider en kijk via een overzichtelijke, snelle interface die gemaakt is voor de afstandsbediening.
>
> LET OP: Couchbox bevat en levert geen zenders, films of series. Je hebt een eigen abonnement bij een provider nodig. We keuren het streamen van auteursrechtelijk beschermd materiaal zonder toestemming van de rechthebbende niet goed.
>
> LIVE TV & TV-GIDS
> • Zenderlijst met nu/straks en een voorbeeldvenster
> • Tv-gids meerdere dagen vooruit, met herinneringen
> • Gids van je provider of een eigen XMLTV-gids (ook .gz)
> • Zenders en groepen verbergen of verplaatsen, eigen zenderlijsten maken
> • Cijfertoetsen, zender omhoog/omlaag en vorige zender
>
> FILMS & SERIES
> • Rijen per genre, op volgorde van jaar, waardering en populariteit
> • Verder kijken, Mijn lijst en meldingen van nieuwe afleveringen
> • Onthoudt audio- en ondertitelkeuze per serie
> • Volgende aflevering: automatisch, vragen of uit
>
> ZOEKEN & AANBEVELINGEN
> • Zoeken met tikfouten, ook op acteurs en regisseurs
> • Persoonlijke aanbevelingen op basis van wat je kijkt
>
> MEER
> • 9 talen: Nederlands, Engels, Duits, Frans, Spaans, Grieks, Italiaans, Pools, Turks
> • Meerdere profielen, pincode voor instellingen, 18+-categorieën verbergen
> • Optioneel: posters, beschrijvingen en genres via je eigen gratis TMDB-sleutel
>
> Dit product gebruikt de TMDB API, maar wordt niet onderschreven of gecertificeerd door TMDB.

## 3. Testaccount voor de keurders

Samsung vraagt hoe ze de app kunnen testen. Gebruik de ingebouwde demo, **nooit je eigen abonnement**:

> No subscription is needed for testing. On the login screen, enter **demo** as the server URL (leave username and password empty) and press Connect. The demo contains test channels, movies and series with a TV guide; videos are public test streams (Big Buck Bunny, Sintel, Apple HLS examples).

## 4. Afbeeldingen (allemaal 1920×1080)

| Wat | Bestand | Formaat | Maken met |
|---|---|---|---|
| Screenshots | `store/screenshots/<taal>-*.jpg` | JPG | `node scripts/store-screenshots.mjs en` (of `nl`) |
| Logo | `store/logo.png` | PNG, 32-bit (met transparantie) | `node scripts/store-assets.mjs` |
| Achtergrond | `store/background.jpg` | JPG | `node scripts/store-assets.mjs` |
| App-icoon (in het pakket) | `icon.png` | PNG 512×423 | `node scripts/make-icon.js` |

- De screenshots komen uit de demo-modus zonder TMDB, dus zonder beelden of teksten van echte films.
- Het logo heeft witte letters voor een donkere achtergrond.

## 5. Privacyverklaring

`docs/privacy.html` (Engels en Nederlands). Vul eerst [NAME]/[NAAM] en [EMAIL]/[E-MAIL] in en zet hem op een openbaar adres. Vul dat adres in de Seller Office in, en in `js/config.js` (`privacyUrl`), zodat hij ook in *Instellingen → Over deze app* staat.
