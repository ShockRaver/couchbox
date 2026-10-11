# Kijkdoos for Samsung Tizen TV

A Tizen web app (HTML5/JS, no build step) for Xtream Codes IPTV, styled like a streaming service. It was built for the Samsung QE50QN90DATXXN (2024, now on Tizen 9) and should run on any Samsung TV from 2021 onward. The app is available in English, Dutch, German, French, Spanish, Greek, Italian, Polish and Turkish.

## Features

**Sources**
- **Xtream** (server + username + password), **an Xtream link** (`…/get.php?username=…&password=…`: username and password are taken from the link, so you only type one field), or **an M3U/M3U8 playlist** (any link). M3U lists are downloaded once, read in parts (large lists are fine), kept for 6 hours and shown exactly like an Xtream server: `group-title` becomes the category, `tvg-logo` the logo, `tvg-id` the EPG id, and `x-tvg-url` in the playlist header is used as the XMLTV guide automatically. Movies and series are recognised from Xtream-style addresses, file extensions (.mp4/.mkv…) and `S01E02` in the name.
- Note: M3U lists contain no TMDB ids, so movies and series from an M3U list get no TMDB posters or descriptions yet.

**Watching**
- **Live TV**: categories, a virtualised channel list (thousands of channels stay fast), now/next EPG with a progress bar, and a live preview window
- **TV guide**: timeline grid, several days ahead (◀▶ through time, ▲▼ through channels). Pick a group (favourites, all channels, or any category), jump to *now*, *tonight* or another day, and set **reminders** for upcoming programmes (a pop-up with "Watch" when they start, while the app is open)
- **Movies & series**: Netflix-style pages with a hero banner, rows per genre, detail pages with cast, seasons/episodes, next episode played automatically
- **Seasonal categories** (`js/season.js`): *Halloween*, *Christmas & Sinterklaas* and *Valentine's Day*. Always available under Categories; from 4 weeks before the date they also appear as a row on Home, Movies and Series. Titles come from TMDB keywords (only what's in your library), provider categories with such a name, and titles containing such a word.
- **Ordering of genre rows** (`js/rank.js`): a mix of release year (recent first), weighted rating, TMDB popularity and how recently the provider added it, instead of "last added by the provider" (providers often add whole old catalogues at once). A title isn't shown up front in more than one row, titles you've watched move back, and the top of each row shifts a little every day. *Nieuw toegevoegd* stays ordered by date added, but titles released more than 15 years ago move to the back.
- **Audio track & subtitles**: pick them while playing, plus a preferred language in settings; for series your choice is remembered for all episodes. Subtitle size: small to extra large (*Settings → Subtitle size*)
- **Online subtitles** (`js/subs.js`, needs your own free [OpenSubtitles](https://www.opensubtitles.com) API key: *Settings → Online subtitles*): in the player ▼ → *Subtitles* → *Search online*. Searched by TMDB id (film, or series + season + episode), otherwise by title. The file (SRT/WebVTT, UTF-8 or Windows-1252) is shown on the player's clock, can be shifted in 0.5 s steps, and is stored locally with its offset per title, so resuming costs no new download (OpenSubtitles limits downloads per day). For series the language is remembered and the next episodes get subtitles automatically; with a preferred subtitle language set, films without that language get them automatically too (can be switched off). The API needs its query parameters sorted and lowercase, and browsers can't set User-Agent, so `X-User-Agent` is sent.
- **Trailers** open in the TV's YouTube app. YouTube's embedded player needs an HTTP Referer, and a Tizen app runs from `file://` without one (error 153), so in-app playback only works in the browser test version; movie pages show other parts of the same **collection** ("Uit de reeks") that are in your library
- **4K/HDR labels** on posters and channels (recognised from the name)
- **Channel management** (Live TV, hold OK on a channel or group): hide channels or whole groups, sort channels **A-Z** or by number (ignores prefixes like "NL |", numbers by value; favourites and own lists keep their own order), move groups and favourites with ▲▼, and make your **own channel lists** (e.g. Sports, Kids) that also show up in the TV guide. *Settings → Hidden channels and groups* brings things back and restores the group order.
- **TV guide source** (*Settings → TV guide source*): the provider's guide per channel (default), the provider's full **XMLTV** file, or your **own XMLTV address** (also .gz; on-screen keyboard with capitals and punctuation). Channels are matched on the provider's EPG id or on name ("NL | NPO 1 HD" = "NPO 1"); channels without XMLTV data keep the provider's guide. Wrong match? In the TV guide, hold OK → *Match guide data…*. The file is streamed and parsed in parts, only your channels are kept (4 hours back to 3 days ahead), refreshed every 12 hours.
- **Next episode**: automatically, ask, or off (*Settings → Play next episode*). With "automatically" the next episode is offered in the last 20 seconds (OK = now, Back = keep watching the credits) and starts right when the episode ends. The next stream is deliberately not pre-buffered: AVPlay has one player, and most providers allow only one connection, so a second request could break the episode that's playing.
- **Live stream format fallback**: if a channel doesn't play as .m3u8, the player immediately tries .ts (and the other way round) before retrying, and remembers per channel what works
- Number keys to jump to a channel, CH+/CH− to zap, previous channel (PRE-CH, or the *Vorige* button in the player menu), picture format (fit/stretch/auto), automatic reconnect when a stream drops

**Personal**
- **Continue watching**: position saved every 10 s, one entry per series (up-next episode), watched checkmarks
- **My list** for movies and series, **favourites** for channels (hold OK)
- **New episodes**: series in My list are checked for new episodes, with a notification and a "New episodes" row; *Binnenkort* shows episodes announced for the next 3 weeks (TMDB)
- **Recommendations** on Home and on the Movies/Series pages: *Because you watched X*, **Top 10 this week** (TMDB trending, only what's in your library, with large rank numbers; also titles you've watched), *Trending this week* (the rest), *&lt;genre&gt; for you*, *Highest rated* (weighted), *Dutch & Flemish films*, *Under 90 minutes*. Only titles that are in your own library are shown; anything already watched is skipped.
- **Startup**: start screen, last channel, or ask
- **Multiple profiles** (several servers/subscriptions), stored locally on the TV
- **PIN lock** for settings, and **parental lock** for categories: hold OK on a live group or a movie/series category → *Lock (PIN)*. *Settings → 18+ categories*: show, hide, or lock. Locked content stays out of "All", genres, recommendations and search until the PIN is entered once; it locks again when the app goes to the background (or after 4 hours). Simple parental lock, not real security.

**Languages**
- English (default), Dutch, German, French, Spanish, Greek, Italian, Polish and Turkish, chosen under *Settings → Language* (a confirmation, then the app restarts so every screen is built in the new language). TMDB data (descriptions, titles, genres, biographies, collections, search) follows the same language; after switching, titles are refreshed in the background. The "films in your language" row follows the app language too.
- In the code the Dutch text is the key: `T('Verder kijken')`, with one dictionary per language in `js/lang/<code>.js`. Check with `node scripts/i18n-check.js` (missing translations or `{variables}` in any language, and texts outside `T()`).
- Adding a language: an entry in `CONF` in `js/i18n.js` (name, TMDB code, locale, day/month names), a `js/lang/<code>.js`, a script tag in `index.html`.
- Greek: the on-screen search keyboard only has Latin letters, so Greek TMDB titles can't be typed; provider names and original titles can.

**Search**
- Own on-screen keyboard on the left, results on the right (no Samsung keyboard pop-up)
- Searches the provider's names **and** the Dutch and original TMDB titles
- Tolerates typos ("matirx" → The Matrix, "keanu reves" → Keanu Reeves) and partial words
- Finds **actors and directors** (TMDB) and shows what you have with them ("Met Keanu Reeves in je bibliotheek")
- Duplicates across language categories are merged; results are ranked by match quality, popularity, and your favourites/history
- **"Did you mean …?"**: a word that matches nothing (not even as the start of a word) is replaced by the most common word in your library within a third of its letters; the suggestion appears below the keyboard
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

## Tests

```bash
node tests/run.mjs            # everything
node tests/run.mjs gids       # only tests whose name or file contains "gids"
```

The runner needs Node 22+ and Google Chrome (or Chromium; set `CHROME=/path` if it isn't found). It runs:
- **Checks**: syntax of all JS files, the scripts in `index.html` exist, and translations are complete (`scripts/i18n-check.js`).
- **Screen tests** in headless Chrome against the demo server (`tests/specs/*.mjs`): login, Home (including "focus stays put while rows load"), the top menu, Movies/Series, detail pages, My list, trailers, Live TV, TV guide, search with typos, settings, switching language, channel management, XMLTV guide (demo XMLTV, .gz, time zones, matching), plus some units (EPG clean-up, recommendations, ordering, 4K/HDR labels).
- Any error in the browser console fails a test. On failure a screenshot is saved in `build/test-out/run`.
- Tests marked `tmdb` only run when `js/config.local.js` has a TMDB key; otherwise they're skipped.

**GitHub Actions** (`.github/workflows/test.yml`) runs the same tests on every push and pull request. Results are shown in the run's summary, and screenshots are attached as an artifact. To include the TMDB tests, add the repository secret `TMDB_KEY` (*Settings → Secrets and variables → Actions*).
`scripts/deploy.sh` checks the GitHub result for the current commit and refuses to install if the tests failed (override with `SKIP_TESTS=1`).

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

**Samsung store**: `scripts/store-package.sh iptv` builds `build/store/kijkdoos-<version>.wgt` for the TV Seller Office (without a built-in TMDB key, only from a clean commit whose GitHub tests passed). Store text, test account, screenshots and privacy policy: see `store/README.md`.

The script stamps a version (1.&lt;commit count&gt;), date and commit into the app (*Instellingen → Over deze app*). The app then appears in the TV's app list. Your login details stay on the TV. After installing you don't need the Mac any more, not even to start the app. You only need it again for updates, or if the certificate expires or the TV is reset. The script checks that the profile uses the distributor certificate (a common cause of "Invalid certificate chain").

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
js/build.js             version info (overwritten by deploy.sh)
js/api.js               Xtream Codes API, stream URLs, list cache (memory + IndexedDB)
js/db.js                IndexedDB wrapper
js/meta.js              metadata service (TMDB titles, details, people, library links)
js/tmdb.js              background job that links the library to TMDB
js/genres.js            genre index for movies and series (chunked)
js/rank.js              ordering of titles in genre rows (year, rating, popularity, variety)
js/season.js            seasonal categories and rows (Halloween, Christmas & Sinterklaas, Valentine's Day)
js/m3u.js               M3U/M3U8 playlists, presented as an Xtream server
js/find.js              search index (TMDB titles, typo tolerance, ranking)
js/reco.js              recommendation rows
js/follow.js            new-episode detection for series in My list
js/remind.js            reminders for programmes in the TV guide
js/subs.js              online subtitles (OpenSubtitles): search, download, SRT/WebVTT parsing, local cache
js/player.js            AVPlay (TV) / HTML5 video (browser), audio/subtitle tracks, reconnect
js/epg.js               EPG cache + queue (only fetches visible channels)
js/xmltv.js             XMLTV guide: streaming download/parse (also .gz), channel matching, stored in IndexedDB
js/lineup.js            channel management: hidden channels/groups, group order, own channel lists
js/vlist.js             virtual list/grid with focus handling
js/ui.js                icons, cards, rows, top menu, hero banner
js/storage.js           localStorage: profiles, settings, favourites, history
js/i18n.js              translations (T()), dates and numbers per language; js/lang/*.js = dictionaries (en, de, fr, es, el, it, pl, tr)
js/screens/*.js         screens (home, section, live, guide, catalog, movie, series, person, search, settings, player, …)
js/demo.js              demo server ("demo") for testing without a subscription
scripts/deploy.sh       package + sign + install on the TV
scripts/serve.py        local test server without caching
scripts/i18n-check.js   checks translations
tests/run.mjs           test runner (checks + screen tests); tests/specs/*.mjs = the tests
tests/lib/              headless Chrome via CDP (no npm packages) and a small test web server
tests/setup-demo.js     demo profile with history, My list and a favourite channel
tests/drive.mjs         ad-hoc: run JSON steps in headless Chrome and take screenshots
.github/workflows/      GitHub Actions: tests on every push
scripts/make-icon.js    generates icon.png
```

## Known limitations

- **Multiview** (several streams at once) isn't possible: AVPlay allows one video player per app.
- **Subtitles** from the stream only appear when they are embedded (e.g. MKV/HLS); DVB bitmap subtitles are not supported. Online subtitles (OpenSubtitles) need your own API key, aren't always in sync with your version of the film (use the 0.5 s shift), and OpenSubtitles limits the number of downloads per day (Kijkdoos shows how many are left; signing in to OpenSubtitles is not supported yet).
- **Catch-up / timeshift** (tv_archive) is deliberately not included.
- EPG quality depends on the provider; providers with poor EPG data show empty programmes.
- DRM-protected streams (ClearKey/PlayReady in M3U lists) are not supported yet.
