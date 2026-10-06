# Kijkdoos for Samsung Tizen TV

A Tizen web app (HTML5/JS, no build step) for Xtream Codes IPTV. It was built for the Samsung QE50QN90DATXXN (2024, Tizen 8) and should run on any Samsung TV from 2021 onward. The app UI is in Dutch.

## Features

- **Live TV**: categories, a virtualised channel list (thousands of channels stay fast), now/next EPG with a progress bar, and a live preview window
- **TV guide**: timeline grid per channel (◀▶ through time, ▲▼ through channels)
- **Movies & series**: poster grid, detail pages, seasons/episodes, next episode played automatically
- **Continue watching**: position saved every 10 s; "Resume from 12:34"; watched checkmarks
- **Favourites** for channels, movies and series (hold OK, or the red button)
- **Search** across channels, movies and series
- **Audio track & subtitles**: pick them while playing, plus a preferred language (NL/EN) in settings
- **Last channel remembered**, with optional autoplay at startup
- **Multiple profiles** (several servers/subscriptions), stored locally on the TV
- **PIN lock** for settings, and a filter that hides 18+ categories
- Number keys to jump to a channel, CH+/CH− to zap, ↩ PREV-CH, picture format (fit/stretch/auto)
- Automatic reconnect when a stream drops

## Remote control (SolarCell remote)

The QN90D's SolarCell remote has **no colour or number buttons**. The **123** button shows them on screen. For that reason everything also works with arrows / OK / Back:

| Where | Button | Action |
|---|---|---|
| Lists | OK | open / preview |
| Lists | **Hold OK** | options (favourite, TV guide) |
| Live fullscreen | ▲▼ or CH± | zap |
| Live fullscreen | ◀▶ | channel list |
| Live fullscreen | OK | menu (audio, subtitles, favourite, picture) |
| Movie/episode | OK / ⏯ | pause |
| Movie/episode | ◀▶ (hold = faster) | seek 10 s |
| Movie/episode | ▼ | menu (audio, subtitles, picture, next episode) |

## Test in the browser (UI only)

```bash
cd ~/PhpstormProjects/iptv && python3 -m http.server 8765
```

Open http://127.0.0.1:8765 and enter **`demo`** as the server URL. Keys: arrows, Enter (OK), Esc/Backspace (back), F1–F4 (colours), PageUp/Down (CH±).
Real Xtream servers usually won't work in a desktop browser because of CORS. On the TV that restriction doesn't apply.

## Installing on the TV

**One-time setup**

1. **Developer Mode on the TV**
   - Find your Mac's IP: `ipconfig getifaddr en0`
   - On the TV, open **Apps**, then type **1 2 3 4 5** (with the SolarCell remote, use the 123 button).
   - Turn *Developer mode* **On**, enter your Mac's IP, then restart the TV (hold the power button until the logo appears).
   - Find the TV's IP: *Settings → General → Network → Network status → IP settings*.
2. **Connect the TV**
   ```bash
   ~/tizen-studio/tools/sdb connect <TV-IP>
   ```
3. **Samsung certificate** (required for your own apps on 2024 models)
   - Open `~/tizen-studio/tools/certificate-manager/Certificate-manager.app`
   - Click **+** → **Samsung** → **TV** → profile name **`iptv`**
   - Author certificate: create a new one and sign in with your Samsung account
   - Distributor certificate: privilege *Public*. The TV's DUID is filled in automatically while the TV is connected via `sdb`.

**Install / update**

```bash
~/PhpstormProjects/iptv/scripts/deploy.sh <TV-IP> iptv
```

The app then appears in the TV's app list. Your login details stay on the TV. After installing you don't need the Mac any more, not even to start the app. You only need it again for updates, or if the certificate ever expires or the TV is reset.

## Project structure

```
config.xml            Tizen manifest (privileges, app ID EbIPTVpl01.Kijkdoos)
index.html            entry point
css/app.css           all styling (1920x1080)
js/api.js             Xtream Codes API + stream URLs
js/player.js          AVPlay (TV) / HTML5 video (browser), audio/subtitle tracks, reconnect
js/epg.js             EPG cache + queue (only fetches visible channels)
js/vlist.js           virtual list/grid with focus handling
js/storage.js         localStorage: profiles, settings, favourites, history
js/screens/*.js       screens (home, live, guide, catalog, movie, series, search, settings, player)
js/demo.js            demo server ("demo") for testing without a subscription
scripts/deploy.sh     package + sign + install on the TV
scripts/make-icon.js  generates icon.png
```

## Known limitations

- **Multiview** (several streams at once) isn't possible: AVPlay allows one video player per app.
- **Subtitles** only appear when they are embedded in the stream (e.g. MKV/HLS). Xtream servers rarely provide separate .srt files. DVB bitmap subtitles are not supported.
- **Catch-up / timeshift** (tv_archive) is not built in yet.
- The **full EPG** comes from `get_short_epg` per channel. Providers with poor EPG data will show empty programmes.
