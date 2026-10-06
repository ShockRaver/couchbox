# Kijkdoos for Samsung Tizen TV

A Tizen web app (HTML5/JS, no build step) for Xtream Codes IPTV, styled like a streaming service. It was built for the Samsung QE50QN90DATXXN (2024, now on Tizen 9) and should run on any Samsung TV from 2021 onward. The app UI is in Dutch.

## Features

**Watching**
- **Live TV**: categories, a virtualised channel list (thousands of channels stay fast), now/next EPG with a progress bar, and a live preview window
- **TV guide**: timeline grid, several days ahead (◀▶ through time, ▲▼ through channels). Pick a group (favourites, all channels, or any category), jump to *now*, *tonight* or another day, and set **reminders** for upcoming programmes (a pop-up with "Watch" when they start, while the app is open)
- **Movies & series**: Netflix-style pages with a hero banner, rows per genre, detail pages with cast, seasons/episodes, next episode played automatically
- **Audio track & subtitles**: pick them while playing, plus a preferred language (NL/EN) in settings
- Number keys to jump to a channel, CH+/CH− to zap, ↩ PREV-CH, picture format (fit/stretch/auto), automatic reconnect when a stream drops

**Personal**
- **Continue watching**: position saved every 10 s, one entry per series (up-next episode), watched checkmarks
- **My list** for movies and series, **favourites** for channels (hold OK)
- **New episodes**: series in My list are checked for new episodes, with a notification and a "New episodes" row
- **Recommendations** on Home and on the Movies/Series pages: *Because you watched X*, *Trending this week*, *&lt;genre&gt; for you*, *Highest rated* (weighted), *Dutch & Flemish films*, *Under 90 minutes*. Only titles that are in your own library are shown; anything already watched is skipped.
- **Startup**: start screen, last channel, or ask
- **Multiple profiles** (several servers/subscriptions), stored locally on the TV
- **PIN lock** for settings, and a filter that hides 18+ categories

**Search**
- Own on-screen keyboard on the left, results on the right (no Samsung keyboard pop-up)
- Searches the provider's names **and** the Dutch and original TMDB titles
- Tolerates typos ("matirx" → The Matrix, "keanu reves" → Keanu Reeves) and partial words
- Finds **actors and directors** (TMDB) and shows what you have with them ("Met Keanu Reeves in je bibliotheek")
- Duplicates across language categories are merged; results are ranked by match quality, popularity, and your favourites/history
- Recent searches per profile

**Metadata (TMDB)**
- A background job links your library to TMDB: genres, posters, backdrops, ratings, runtimes (stored in IndexedDB, only new titles are fetched)
- Details (description in Dutch, cast, trailer, recommendations) and person pages are fetched when opened and cached for 30 days
- Genres for movies and series are built from category names + TMDB data, across all languages, with duplicates merged

## Remote control (SolarCell remote)

The QN90D's SolarCell remote has **no colour or number buttons**. The **123** button shows them on screen. For that reason everything works with arrows / OK / Back:

| Where | Button | Action |
|---|---|---|
| Everywhere | ▲ at the top of a list | menu bar (Home, Live TV, Movies, Series, TV guide, My list, search, settings) |
| Rows / lists | OK | open / play |
| Rows / lists | **Hold OK** | options (My list, favourite, remove from Continue watching) |
| Search | arrows + OK | type with the on-screen keyboard; → from the last key goes to the results |
| Live fullscreen | ▲▼ or CH± | zap |
| Live fullscreen | ◀▶ | channel list |
| Live fullscreen | OK | menu (audio, subtitles, favourite, picture) |
| Movie/episode | OK / ⏯ | pause |
| Movie/episode | ◀▶ (hold = faster) | seek 10 s |
| Movie/episode | ▼ | menu (audio, subtitles, picture, My list, next episode) |

## Setup

**TMDB key (optional, recommended)**: genres, posters, search by actor and TMDB recommendations need a free [TMDB](https://www.themoviedb.org/settings/api) API key (v3, 32 characters). Two ways to set it:
- On the TV: *Instellingen → TMDB-gegevens* opens an on-screen keyboard; the key is checked with TMDB before it's saved.
- Built in: put it in `js/config.local.js` (not in git): `CONFIG.tmdbKey = 'your-key';`

Without a key the app still works with provider data only; Home then shows recommendations based on your provider's categories, ratings and newest titles. This product uses the TMDB API but is not endorsed or certified by TMDB. A personal key is for personal use; commercial use needs a TMDB agreement.

## Test in the browser (UI only)

```bash
python3 scripts/serve.py
```

Open http://127.0.0.1:8765 and enter **`demo`** as the server URL. Keys: arrows, Enter (OK), Esc (back), letters type directly in search, F1–F4 (colours), PageUp/Down (CH±).
`serve.py` disables browser caching, so you never get a mix of old and new files after a change.
Real Xtream servers usually won't work in a desktop browser because of CORS. On the TV that restriction doesn't apply.

## Installing on the TV

**One-time setup**

1. **Developer Mode on the TV**
   - Find your Mac's IP: `ipconfig getifaddr en0`
   - On the TV, open **Apps**, then type **1 2 3 4 5** (with the SolarCell remote, use the 123 button).
   - Turn *Developer mode* **On**, enter your Mac's IP, then fully restart the TV (unplug it, or hold the power button until the logo appears).
   - Find the TV's IP: *Settings → General → Network → Network status → IP settings*.
2. **Connect the TV**
   ```bash
   ~/tizen-studio/tools/sdb connect <TV-IP>
   ```
3. **Samsung certificate** (required for your own apps on 2024 models)
   - Open `~/tizen-studio/tools/certificate-manager/Certificate-manager.app`
   - Click **+** → **Samsung** → **TV** → profile name **`iptv`**
   - Author certificate: create a new one and sign in with your Samsung account
   - Distributor certificate: privilege *Public*. The TV's DUID is filled in automatically while the TV is connected via `sdb` (it is *not* the IP address).

**Install / update**

```bash
scripts/deploy.sh <TV-IP> iptv
```

The app then appears in the TV's app list. Your login details stay on the TV. After installing you don't need the Mac any more, not even to start the app. You only need it again for updates, or if the certificate expires or the TV is reset. The script checks that the profile uses the distributor certificate (a common cause of "Invalid certificate chain").

## Performance

Large subscriptions (50,000+ titles) are handled without freezing the TV:
- Full channel/movie/series lists are cached in IndexedDB; after a restart they're available immediately and refreshed in the background when older than 6 hours. *Instellingen → Zenders, films en gids vernieuwen* reloads everything from the provider.
- The genre index is built in small chunks (`U.each`) and prepared in the background after startup, so Movies/Series open instantly.
- Screens draw first and load afterwards; lists are virtualised.

## Project structure

```
config.xml              Tizen manifest (privileges, app ID EbIPTVpl01.Kijkdoos)
index.html              entry point
css/app.css             all styling (1920x1080), design tokens in :root
DESIGN.md               design rules (colours, focus, navigation, icons, motion)
js/config.js            settings (TMDB key goes in config.local.js, not in git)
js/api.js               Xtream Codes API, stream URLs, list cache (memory + IndexedDB)
js/db.js                IndexedDB wrapper
js/meta.js              metadata service (TMDB titles, details, people, library links)
js/tmdb.js              background job that links the library to TMDB
js/genres.js            genre index for movies and series (chunked)
js/find.js              search index (TMDB titles, typo tolerance, ranking)
js/reco.js              recommendation rows
js/follow.js            new-episode detection for series in My list
js/remind.js            reminders for programmes in the TV guide
js/player.js            AVPlay (TV) / HTML5 video (browser), audio/subtitle tracks, reconnect
js/epg.js               EPG cache + queue (only fetches visible channels)
js/vlist.js             virtual list/grid with focus handling
js/ui.js                icons, cards, rows, top menu, hero banner
js/storage.js           localStorage: profiles, settings, favourites, history
js/screens/*.js         screens (home, section, live, guide, catalog, movie, series, person, search, settings, player, …)
js/demo.js              demo server ("demo") for testing without a subscription
scripts/deploy.sh       package + sign + install on the TV
scripts/serve.py        local test server without caching
scripts/make-icon.js    generates icon.png
```

## Known limitations

- **Multiview** (several streams at once) isn't possible: AVPlay allows one video player per app.
- **Subtitles** only appear when they are embedded in the stream (e.g. MKV/HLS). Xtream servers rarely provide separate .srt files. DVB bitmap subtitles are not supported.
- **Catch-up / timeshift** (tv_archive) is deliberately not included.
- EPG quality depends on the provider; providers with poor EPG data show empty programmes.
- Only Xtream Codes is supported as a source (M3U/other sources are on the roadmap).
