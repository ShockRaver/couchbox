# Couchbox for Samsung Tizen TV

A Tizen web app (HTML5/JS, no build step) for IPTV subscriptions (Xtream Codes or M3U), styled like a streaming service. It was built for a Samsung QE50QN90D (2024, Tizen 9) and runs on **Samsung TVs from 2017 onward** (Tizen 3.0+, see [Older TVs](#older-tvs-2017-2020)). The app is available in English, Dutch, German, French, Spanish, Greek, Italian, Polish and Turkish.

Couchbox contains no channels, movies or series itself: it plays what your own subscription provides.

## Features

**Sources**
- **Xtream** (server + username + password), **an Xtream link** (`…/get.php?username=…&password=…`: username and password are taken from the link, so you only type one field), or **an M3U/M3U8 playlist** (any link). M3U lists are downloaded once, read in parts (large lists are fine), kept for 6 hours and shown exactly like an Xtream server: `group-title` becomes the category, `tvg-logo` the logo, `tvg-id` the EPG id, and `x-tvg-url` in the playlist header is used as the XMLTV guide automatically. Movies and series are recognised from Xtream-style addresses, file extensions (.mp4/.mkv…) and `S01E02` in the name.
- Note: M3U lists contain no TMDB ids, so movies and series from an M3U list get no TMDB posters or descriptions yet.

**Watching**
- **Live TV**: categories, a virtualised channel list (thousands of channels stay fast), now/next EPG with a progress bar, and a live preview window
- **TV guide**: timeline grid, several days ahead (◀▶ through time, ▲▼ through channels). Pick a group (favourites, all channels, or any category), jump to *now*, *tonight* or another day, and set **reminders** for upcoming programmes (a pop-up with "Watch" when they start, while the app is open)
- **Movies & series**: streaming-style pages with a hero banner, rows per genre, detail pages with cast, seasons/episodes, and the next episode played automatically
- **Seasons spread over several provider items** (another language category, or seasons added as a separate item, e.g. "EN | Show S04"): opening a series also fetches the other items of the same series (same TMDB id, or same name without language prefix/year/season/quality, but never when TMDB ids or years differ) and fills in missing seasons and episodes; seasons in another language get a tag ("Season 4 · EN"). The season count shown is what your provider has; if TMDB knows more, the page says "4 of 5 seasons available"
- **Seasonal categories** (`js/season.js`): *Halloween*, *Christmas & Sinterklaas* and *Valentine's Day*. Always available under Categories; from 4 weeks before the date they also appear as a row on Home, Movies and Series. Titles come from TMDB keywords (only what's in your library), provider categories with such a name, and titles containing such a word.
- **Ordering of genre rows** (`js/rank.js`): a mix of release year (recent first), weighted rating, TMDB popularity and how recently the provider added it, instead of "last added by the provider" (providers often add whole old catalogues at once). A title isn't shown up front in more than one row, titles you've watched move back, and the top of each row shifts a little every day. *Recently added* stays ordered by date added, but titles released more than 15 years ago move to the back.
- **Audio track & subtitles**: pick them while playing, plus a preferred language in settings (default *Automatic*: if a film or episode has exactly one subtitle track it is switched on, also when its language is unknown; not for live channels). For series your choice is remembered for all episodes. Subtitle size: small to extra large (*Settings → Subtitle size*)
- **Online subtitles** (`js/subs.js`, needs your own free [OpenSubtitles](https://www.opensubtitles.com) API key: *Settings → Online subtitles*; without a key the option is hidden): in the player ▼ → *Subtitles* → *Search online*. Searched by TMDB id (film, or series + season + episode), otherwise by title. The file (SRT/WebVTT, UTF-8 or Windows-1252) is shown on the player's clock, can be shifted in 0.5 s steps, and is stored locally with its offset per title, so resuming costs no new download (OpenSubtitles limits downloads per day). For series the language is remembered and the next episodes get subtitles automatically; with a preferred subtitle language set, films without that language get them automatically too (can be switched off). The API needs its query parameters sorted and lowercase, and browsers can't set User-Agent, so `X-User-Agent` is sent.
- **Trailers** open in the TV's YouTube app. YouTube's embedded player needs an HTTP Referer, and a Tizen app runs from `file://` without one (error 153), so in-app playback only works in the browser test version. Movie pages also show other parts of the same **collection** that are in your library
- **4K/HDR labels** on posters and channels (recognised from the name)
- **Channel management** (Live TV, hold OK on a channel or group): hide channels or whole groups, sort channels **A-Z** or by number (ignores prefixes like "NL |", numbers by value; favourites and own lists keep their own order), move groups and favourites with ▲▼, and make your **own channel lists** (e.g. Sports, Kids) that also show up in the TV guide. *Settings → Hidden channels and groups* brings things back and restores the group order.
- **TV guide source** (*Settings → TV guide source*): the provider's guide per channel (default), the provider's full **XMLTV** file, or your **own XMLTV address** (also .gz; on-screen keyboard with capitals and punctuation). Channels are matched on the provider's EPG id or on name ("NL | NPO 1 HD" = "NPO 1"); channels without XMLTV data keep the provider's guide. Wrong match? In the TV guide, hold OK → *Match guide data…*. The file is streamed and parsed in parts, only your channels are kept (4 hours back to 3 days ahead), refreshed every 12 hours.
- **Next episode**: automatically, ask, or off (*Settings → Play next episode*). With "automatically" the next episode is offered in the last 20 seconds (OK = now, Back = keep watching the credits) and starts right when the episode ends. The next stream is deliberately not pre-buffered: AVPlay has one player, and most providers allow only one connection, so a second request could break the episode that's playing.
- **Live stream format fallback**: if a channel doesn't play as .m3u8, the player immediately tries .ts (and the other way round) before retrying, and remembers per channel what works
- Number keys to jump to a channel, CH+/CH− to zap, previous channel (PRE-CH, or the *Previous* button in the player menu), picture format (fit/stretch/auto), automatic reconnect when a stream drops

**Personal**
- **Continue watching**: position saved every 10 s, one entry per series (up-next episode), watched checkmarks
- **My list** for movies and series, **favourites** for channels (hold OK)
- **New episodes**: series in My list are checked for new episodes, with a notification and a "New episodes" row; *Coming soon* shows episodes announced for the next 3 weeks (TMDB)
- **Rate titles** on movie and series pages (*Rate* → *I like this* / *Not for me*, stored per profile on the TV, `js/taste.js`). Likes count +3 and dislikes −3 per genre in your taste profile (next to watching +2 and My list +1); "Not for me" titles are never recommended and move to the back of genre rows.
- **Recommendations** on Home and on the Movies/Series pages: **For you** (first row, across all genres, scored on how well a title's genres fit your taste profile, quality, popularity and similarity to titles you liked via TMDB recommendations; without TMDB it uses genres from category names), *Because you watched X*, **Top 10 this week** (TMDB trending, only what's in your library, with large rank numbers; also titles you've watched), *Trending this week* (the rest), *&lt;genre&gt; for you*, *Highest rated* (weighted), *films in your language* (e.g. *Dutch & Flemish films*), *Under 90 minutes*. Only titles that are in your own library are shown; anything already watched is skipped.
- **Startup**: start screen, last channel, or ask
- **Multiple profiles** (several servers/subscriptions), stored locally on the TV
- **PIN lock** for settings, and **parental lock** for categories: hold OK on a live group or a movie/series category → *Lock (PIN)*. *Settings → 18+ categories*: show, hide, or lock. Locked content stays out of "All", genres, recommendations and search until the PIN is entered once; it locks again when the app goes to the background (or after 4 hours). A simple parental lock, not real security.

**Languages**
- English (default), Dutch, German, French, Spanish, Greek, Italian, Polish and Turkish, chosen under *Settings → Language* (a confirmation, then the app restarts so every screen is built in the new language). TMDB data (descriptions, titles, genres, biographies, collections, search) follows the same language; after switching, titles are refreshed in the background. The "films in your language" row follows the app language too.
- In the code the **Dutch text is the translation key**: `T('Verder kijken')` shows "Continue watching" in English, with one dictionary per language in `js/lang/<code>.js`. Check with `node scripts/i18n-check.js` (missing translations or `{variables}` in any language, and texts outside `T()`).
- Adding a language: an entry in `CONF` in `js/i18n.js` (name, TMDB code, locale, day/month names), a `js/lang/<code>.js`, and a script tag in `index.html`.
- Greek: the on-screen search keyboard only has Latin letters, so Greek TMDB titles can't be typed; provider names and original titles can.

**Search**
- Own on-screen keyboard on the left, results on the right (no Samsung keyboard pop-up)
- Searches the provider's names **and** the TMDB titles (in the app language and the original title)
- Tolerates typos ("matirx" → The Matrix, "keanu reves" → Keanu Reeves) and partial words
- Finds **actors and directors** (TMDB) and shows what you have with them ("With Keanu Reeves in your library")
- **"Did you mean …?"**: a word that matches nothing (not even as the start of a word) is replaced by the most common word in your library within a third of its letters; the suggestion appears below the keyboard
- Duplicates across language categories are merged; results are ranked by match quality, popularity, and your favourites/history
- Recent searches per profile

**Metadata (TMDB)**
- A background job links your library to TMDB: genres, posters, backdrops, ratings, runtimes (stored in IndexedDB, only new titles are fetched)
- Details (description in the app language, cast, trailer, recommendations) and person pages are fetched when opened and cached for 30 days
- Genres for movies and series are built from category names + TMDB data, across all languages, with duplicates merged

## Remote control (SolarCell remote)

Recent Samsung SolarCell remotes have **no colour or number buttons** (the **123** button shows them on screen). For that reason everything works with arrows / OK / Back:

| Where | Button | Action |
|---|---|---|
| Everywhere | ▲ at the top of a list | menu bar (Home, Live TV, Movies, Series, TV guide, My list, search, settings) |
| Rows / lists | OK | open / play |
| Rows / lists | **Hold OK** | options (My list, favourite, lock, remove from Continue watching) |
| Search | arrows + OK | type with the on-screen keyboard; → from the last key goes to the results |
| Live fullscreen | ▲▼ or CH± | zap |
| Live fullscreen | ◀▶ | channel list |
| Live fullscreen | OK | menu (audio, subtitles, favourite, picture) |
| Movie/episode | OK / ⏯ | pause |
| Movie/episode | ◀▶ (hold = faster) | seek 10 s |
| Movie/episode | ▼ | menu (audio, subtitles, picture, My list, next episode) |

## Setup

**TMDB key (optional, recommended)**: genres, posters, search by actor and TMDB recommendations need a free [TMDB](https://www.themoviedb.org/settings/api) API key (v3, 32 characters). Two ways to set it:
- On the TV: *Settings → TMDB data* opens an on-screen keyboard; the key is checked with TMDB before it's saved.
- Built in (your own builds only): put it in `js/config.local.js`, which is not in git: `CONFIG.tmdbKey = 'your-key';`

Without a key the app still works with provider data only; Home then shows recommendations based on your provider's categories, ratings and newest titles.

**TMDB terms** ([API terms of use](https://www.themoviedb.org/api-terms-of-use)):
- Attribution: *Settings → About this app* and the TMDB settings show the approved TMDB logo (`img/tmdb.svg`, unmodified, from [TMDB's logo page](https://www.themoviedb.org/about/logos-attribution)) with the required notice: *This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.*
- Caching: TMDB data may be kept for at most 6 months. Couchbox keeps it for 150 days (`KEEP_DAYS` in `js/meta.js`): older titles, genres, details, people and lists are deleted and fetched again when needed.
- Your key is yours: never commit it (`js/config.local.js` is ignored by git). Commercial use (e.g. charging for the app or showing ads) needs a separate agreement with TMDB.

**OpenSubtitles key (optional)**: *Settings → Online subtitles*, or `CONFIG.osKey = 'your-key';` in `js/config.local.js`.

## Older TVs (2017–2020)

The app requires Tizen 3.0 (`required_version` in `config.xml`). Each TV year has an older built-in browser (2017: Chromium 47, 2018: 56, 2019: 63, 2020: 69, 2021: 76, 2022: 85). Newer TVs run exactly the same code as before; older ones get fallbacks, chosen by feature detection, not by model:

- **CSS variables** (missing before Chromium 49, the 2017 TVs): `js/compat.js` loads `css/app.legacy.css` instead of `css/app.css`. That file is `app.css` with all `var(--…)` values filled in and `-webkit-` prefixes added.
- **Flexbox `gap`** (missing before Chromium 84, so also on 2021 TVs) and **CSS grid** (missing before Chromium 57): `js/compat.js` adds the class `no-flexgap` / `no-grid` to `<html>`, and `css/compat.css` replaces the gaps with margins and lays out the search keyboard with flexbox.
- Both stylesheets are **generated** from `app.css` by `node scripts/compat-css.mjs`; the tests fail when they are out of date. A few hand-written exceptions live in that script.
- **Compressed (.gz) XMLTV guides** without `DecompressionStream` (before Chromium 80): `js/inflate.js` (a small DEFLATE/gzip decoder) unpacks the file in memory, up to 12 MB compressed.
- **IndexedDB `getAll`** (missing before Chromium 48): read with a cursor instead.
- The code avoids newer JavaScript syntax and APIs (no arrow functions, `let`/`const`, template strings, `?.`, `Promise.finally`, Unicode regex classes); stay with ES5 plus Promise/fetch/Map/Set/Object.assign when adding code.

Tested: the whole test suite in current Chrome and in **Chromium 76** (the 2021 browser); the 2017 stylesheet path is checked with screenshots. Chromium 47 and 56 (2017/2018) don't start on current macOS, so those versions are not tested in a real old browser yet. 2015–2016 TVs (Tizen 2.x) use a different browser engine and are not supported.

To run the tests in an old Chromium, download a build from the [Chromium snapshot archive](https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html) (e.g. `Mac/665002` for Chromium 76) and run:

```bash
CHROME=/path/to/Chromium.app/Contents/MacOS/Chromium CHROME_OLD=1 node tests/run.mjs
```

## Test in the browser (UI only)

```bash
python3 scripts/serve.py
```

Open http://127.0.0.1:8765 and enter **`demo`** as the server URL. Keys: arrows, Enter (OK), Esc (back), letters type directly in search, F1–F4 (colours), PageUp/Down (CH±).
`serve.py` disables browser caching, so you never get a mix of old and new files after a change.
Real Xtream servers usually won't work in a desktop browser because of CORS. On the TV that restriction doesn't apply.

## Tests

```bash
node tests/run.mjs              # everything
node tests/run.mjs ondertitels  # only tests whose name or file contains "ondertitels"
```

The filter matches test names and file names, which are in Dutch (e.g. `ondertitels` = subtitles, `zoeken` = search, `gids` = guide).

The runner needs Node 22+ and Google Chrome (or Chromium; set `CHROME=/path` if it isn't found). It runs:
- **Checks**: syntax of all JS files, the scripts in `index.html` exist, no `alert`/`confirm`/`prompt` (Samsung's store review rejects them), the stylesheets for older TVs are up to date, and translations are complete (`scripts/i18n-check.js`).
- **Screen tests** in headless Chrome against the demo server (`tests/specs/*.mjs`): login, Home, the top menu, Movies/Series, detail pages, ratings and *For you*, My list, trailers, Live TV, TV guide, channel management and A-Z sorting, search with typos and *Did you mean*, settings and the parental lock, switching language, XMLTV (also .gz, with both decoders), M3U playlists, seasonal rows, merging seasons, subtitles (stream and OpenSubtitles, against a mocked API), plus some units (EPG clean-up, recommendations, ordering, 4K/HDR labels).
- Any error in the browser console fails a test. On failure a screenshot is saved in `build/test-out/run`.
- Tests marked `tmdb` only run when `js/config.local.js` has a TMDB key; otherwise they're skipped.

**GitHub Actions** (`.github/workflows/test.yml`) runs the same tests on every push and pull request. Results are shown in the run's summary, and screenshots are attached as an artifact. To include the TMDB tests, add the repository secret `TMDB_KEY` (*Settings → Secrets and variables → Actions*).
`scripts/deploy.sh` checks the GitHub result for the current commit and refuses to install if the tests failed (override with `SKIP_TESTS=1`).

## Installing on the TV

The Tizen CLI tools (`sdb` and the bundled Java) are Intel-only on macOS: on Apple Silicon they need Rosetta (`softwareupdate --install-rosetta --agree-to-license`), also again after some macOS upgrades.

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
3. **Samsung certificate** (required for your own apps on recent models)
   - Open `~/tizen-studio/tools/certificate-manager/Certificate-manager.app`
   - Click **+** → **Samsung** → **TV** → profile name **`iptv`**
   - Author certificate: create a new one and sign in with your Samsung account
   - Distributor certificate: privilege *Public*. The TV's DUID is filled in automatically while the TV is connected via `sdb` (it is *not* the IP address).

**Install / update**

```bash
scripts/deploy.sh <TV-IP> iptv
```

The script stamps a version (1.&lt;commit count&gt;), date and commit into the app (*Settings → About this app*). The app then appears in the TV's app list. Your login details stay on the TV. After installing you don't need the Mac any more, not even to start the app. You only need it again for updates, or if the certificate expires or the TV is reset. The script checks that the profile uses the distributor certificate (a common cause of "Invalid certificate chain").

**Samsung store**: `scripts/store-package.sh iptv` builds `build/store/couchbox-<version>.wgt` for the TV Seller Office (without a built-in TMDB or OpenSubtitles key, only from a clean commit whose GitHub tests passed). Store text, test account, screenshots and privacy policy: see `store/README.md`.

## Performance

Large subscriptions (50,000+ titles) are handled without freezing the TV:
- Full channel/movie/series lists are cached in IndexedDB; after a restart they're available immediately and refreshed in the background when older than 6 hours. *Settings → Refresh channels, movies and guide* reloads everything from the provider.
- The genre index is built in small chunks (`U.each`) and prepared in the background after startup, so Movies/Series open instantly.
- Screens draw first and load afterwards; lists are virtualised.

## Project structure

```
config.xml              Tizen manifest (privileges, app ID EbIPTVpl01.Kijkdoos (kept from the former name, so existing installs keep their data), required Tizen version)
index.html              entry point
css/app.css             all styling (1920x1080), design tokens in :root
css/compat.css          generated: fallbacks for older TVs (no flexbox gap / no CSS grid)
css/app.legacy.css      generated: app.css without CSS variables, for 2017 TVs
DESIGN.md               design rules (colours, focus, navigation, icons, motion)
js/compat.js            detects older TV browsers and picks the stylesheets
js/config.js            settings (own keys go in config.local.js, not in git)
js/build.js             version info (overwritten by deploy.sh)
js/api.js               Xtream Codes API, stream URLs, list cache (memory + IndexedDB)
js/db.js                IndexedDB wrapper
js/meta.js              metadata service (TMDB titles, details, people, library links)
js/tmdb.js              background job that links the library to TMDB
js/genres.js            genre index for movies and series (chunked)
js/rank.js              ordering of titles in genre rows (year, rating, popularity, variety)
js/season.js            seasonal categories and rows (Halloween, Christmas & Sinterklaas, Valentine's Day)
js/m3u.js               M3U/M3U8 playlists, presented as an Xtream server
js/find.js              search index (TMDB titles, typo tolerance, "did you mean", ranking)
js/reco.js              recommendation rows (For you, Top 10, …)
js/taste.js             ratings: I like this / Not for me
js/follow.js            new-episode detection for series in My list
js/remind.js            reminders for programmes in the TV guide
js/subs.js              online subtitles (OpenSubtitles): search, download, SRT/WebVTT parsing, local cache
js/player.js            AVPlay (TV) / HTML5 video (browser), audio/subtitle tracks, reconnect
js/epg.js               EPG cache + queue (only fetches visible channels)
js/xmltv.js             XMLTV guide: streaming download/parse (also .gz), channel matching, stored in IndexedDB
js/inflate.js           gzip/DEFLATE decoder for TVs without DecompressionStream
js/lineup.js            channel management: hidden channels/groups, group order, own channel lists, A-Z
js/vlist.js             virtual list/grid with focus handling
js/ui.js                icons, cards, rows, top menu, hero banner
js/storage.js           localStorage: profiles, settings, favourites, history
img/tmdb.svg            official TMDB logo (attribution)
js/i18n.js              translations (T()), dates and numbers per language; js/lang/*.js = dictionaries (en, de, fr, es, el, it, pl, tr)
js/screens/*.js         screens (home, section, live, guide, catalog, movie, series, person, search, settings, player, …)
js/demo.js              demo server ("demo") for testing without a subscription
docs/privacy.html       privacy policy (English and Dutch)
store/                  Samsung store texts and images
scripts/deploy.sh       package + sign + install on the TV
scripts/store-package.sh  store package (.wgt) for the Samsung Seller Office
scripts/compat-css.mjs  generates the stylesheets for older TVs
scripts/serve.py        local test server without caching
scripts/i18n-check.js   checks translations
scripts/make-icon.js    generates icon.png
tests/run.mjs           test runner (checks + screen tests); tests/specs/*.mjs = the tests
tests/lib/              headless Chrome via CDP (no npm packages) and a small test web server
tests/fixtures/         test data served by the test server (M3U, XMLTV, .gz, mocked OpenSubtitles)
tests/setup-demo.js     demo profile with history, My list and a favourite channel
tests/drive.mjs         ad-hoc: run JSON steps in headless Chrome and take screenshots
.github/workflows/      GitHub Actions: tests on every push
```

Code comments are in Dutch.

## License

[MIT](LICENSE). TMDB data and logos are not covered by this license; they are subject to TMDB's terms.

## Known limitations

- **Multiview** (several streams at once) isn't possible: AVPlay allows one video player per app.
- **Subtitles** from the stream only appear when they are embedded (e.g. MKV/HLS); DVB bitmap subtitles are not supported. Online subtitles (OpenSubtitles) need your own API key, aren't always in sync with your version of the film (use the 0.5 s shift), and OpenSubtitles limits the number of downloads per day (Couchbox shows how many are left; signing in to OpenSubtitles is not supported yet).
- **Catch-up / timeshift** (tv_archive) is deliberately not included.
- EPG quality depends on the provider; providers with poor EPG data show empty programmes.
- DRM-protected streams (ClearKey/PlayReady in M3U lists) are not supported yet.
- On older TVs, compressed XMLTV guides larger than 12 MB can't be unpacked; use an uncompressed .xml address there.
