/* Videospeler: Samsung AVPlay op de TV, HTML5 <video> als fallback in de browser */
var Player = (function () {
    'use strict';

    var av = null, obj = null, video = null, hls = null;
    var subs = {};
    var cur = { url: null, opts: {} };
    var state = 'idle';       // idle | loading | playing | paused | retry | error | ended
    var rect = null;          // null = volledig scherm, anders DOMRect (venstercoördinaten)
    var token = 0, retries = 0, lastTime = 0, retryTimer = null, subsOn = false, suspended = null;

    function noop() {}
    function on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return function () { off(ev, fn); }; }
    function off(ev, fn) { subs[ev] = (subs[ev] || []).filter(function (f) { return f !== fn; }); }
    function emit(ev, a, b) { (subs[ev] || []).slice().forEach(function (f) { try { f(a, b); } catch (e) { console.error(e); } }); }
    function setState(s) {
        if (state === s) return;
        state = s;
        // Speelt het andere formaat wel (zie fail): laten weten, zodat het voor deze zender onthouden wordt
        if (s === 'playing' && cur.altUsed && cur.opts.onAlt) { var f = cur.opts.onAlt; cur.opts.onAlt = null; try { f(cur.url); } catch (e) { /* negeren */ } }
        emit('state', s);
    }

    function init() {
        if (window.webapis && webapis.avplay) {
            av = webapis.avplay;
            obj = document.createElement('object');
            obj.type = 'application/avplayer';
            obj.id = 'av-player';
            document.body.insertBefore(obj, document.body.firstChild);
        } else {
            video = document.createElement('video');
            video.id = 'html-player';
            video.setAttribute('playsinline', '');
            document.body.insertBefore(video, document.body.firstChild);
            video.addEventListener('playing', function () { emit('buffering', false); setState('playing'); });
            video.addEventListener('pause', function () { if (state === 'playing') setState('paused'); });
            video.addEventListener('waiting', function () { emit('buffering', true); });
            video.addEventListener('timeupdate', function () { lastTime = video.currentTime * 1000; });
            video.addEventListener('ended', function () { setState('ended'); emit('ended'); });
            video.addEventListener('error', function () { if (cur.url) fail(T('Afspeelfout (code {code})', { code: video.error && video.error.code })); });
        }
        applyRect();
        document.addEventListener('visibilitychange', onVisibility);
    }

    function isNative() { return !!av; }

    // AVPlay rekent altijd in een 1920x1080-raster
    function screenRect() {
        if (!rect) return { x: 0, y: 0, w: 1920, h: 1080 };
        var f = 1920 / (window.innerWidth || 1920);
        return { x: Math.round(rect.left * f), y: Math.round(rect.top * f), w: Math.round(rect.width * f), h: Math.round(rect.height * f) };
    }

    function aspect() { return rect ? 'letterbox' : Store.settings().aspect; }

    function applyAspect() {
        var a = aspect();
        if (av) {
            var m = a === 'fill' ? 'PLAYER_DISPLAY_MODE_FULL_SCREEN' : a === 'auto' ? 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO' : 'PLAYER_DISPLAY_MODE_LETTER_BOX';
            if (cur.url) try { av.setDisplayMethod(m); } catch (e) { /* niet in elke status toegestaan */ }
        } else if (video) {
            video.style.objectFit = a === 'fill' ? 'fill' : 'contain';
        }
    }

    function applyRect() {
        var el = obj || video;
        if (!el) return;
        var s = el.style;
        if (rect) { s.left = rect.left + 'px'; s.top = rect.top + 'px'; s.width = rect.width + 'px'; s.height = rect.height + 'px'; }
        else { s.left = '0px'; s.top = '0px'; s.width = window.innerWidth + 'px'; s.height = window.innerHeight + 'px'; }
        if (av && cur.url) {
            var r = screenRect();
            try { av.setDisplayRect(r.x, r.y, r.w, r.h); } catch (e) { /* negeren */ }
        }
        applyAspect();
    }

    function setRect(r) { rect = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null; applyRect(); }

    function play(url, opts) {
        halt();
        cur = { url: url, opts: opts || {} };
        retries = 0;
        lastTime = (opts && opts.startAt) || 0;
        start();
    }

    function start() {
        var my = ++token, o = cur.opts;
        setState('loading');
        emit('buffering', true);
        if (av) {
            try {
                av.open(cur.url);
                av.setListener({
                    onbufferingstart: function () { if (my === token) emit('buffering', true); },
                    onbufferingprogress: noop,
                    onbufferingcomplete: function () { if (my === token) emit('buffering', false); },
                    oncurrentplaytime: function (ms) { if (my === token) lastTime = ms; },
                    onstreamcompleted: function () { if (my === token) { setState('ended'); emit('ended'); } },
                    onerror: function (err) { if (my === token) fail(err); },
                    onevent: noop,
                    onsubtitlechange: function (dur, text) { if (my === token) emit('subtitle', text, dur); },
                    ondrmevent: noop
                });
                var r = screenRect();
                av.setDisplayRect(r.x, r.y, r.w, r.h);
                applyAspect();
                if (o.uhd) { try { av.setStreamingProperty('SET_MODE_4K', 'TRUE'); } catch (e) { /* niet elke stream */ } }
                av.prepareAsync(function () {
                    if (my !== token) return;
                    var at = o.live ? 0 : lastTime;
                    if (at > 1000) av.seekTo(at, function () { if (my === token) doPlay(my); }, function () { if (my === token) doPlay(my); });
                    else doPlay(my);
                }, function (e) { if (my === token) fail(e); });
            } catch (e) { fail(e); }
        } else {
            var isHls = /\.m3u8(\?|$)/i.test(cur.url);
            if (isHls && !video.canPlayType('application/vnd.apple.mpegurl') && window.Hls && window.Hls.isSupported()) {
                hls = new window.Hls();
                hls.loadSource(cur.url);
                hls.attachMedia(video);
                hls.on(window.Hls.Events.ERROR, function (e, d) { if (d.fatal && my === token) fail(d.type); });
            } else {
                video.src = cur.url;
            }
            video.onloadedmetadata = function () {
                if (my !== token) return;
                if (!o.live && lastTime > 1000) video.currentTime = lastTime / 1000;
                setTimeout(applyTrackPrefs, 300);
            };
            var pr = video.play();
            if (pr && pr.catch) pr.catch(function (err) { if (my === token && err.name !== 'AbortError') fail(err.message); });
        }
    }

    function doPlay(my) {
        try {
            av.play();
            setState('playing');
            emit('buffering', false);
            // Sporen pas kiezen als het afspelen loopt; in READY weigeren sommige firmwares dit
            setTimeout(function () { if (my === token) applyTrackPrefs(); }, 800);
        } catch (e) { fail(e); }
    }

    function fail(err) {
        var msg = typeof err === 'string' ? err : (err && (err.message || err.name)) || T('onbekende fout');
        console.warn('Speler-fout:', msg);
        var keepAt = lastTime;
        halt();
        lastTime = keepAt;
        var max = cur.opts.live ? 5 : 2;
        // Live-zender speelt niet: eerst meteen het andere streamformaat proberen (.m3u8 <-> .ts), dan pas opnieuw proberen
        if (cur.url && cur.opts.live && cur.opts.alt && !cur.altUsed) {
            cur.altUsed = true;
            cur.url = cur.opts.alt;
            setState('retry');
            emit('retry', 0);
            retryTimer = setTimeout(start, 300);
            return;
        }
        if (cur.url && retries < max) {
            retries++;
            setState('retry');
            emit('retry', retries);
            retryTimer = setTimeout(start, 1500 * retries);
        } else {
            setState('error');
            emit('buffering', false);
            emit('error', msg);
        }
    }

    // Stopt het afspelen maar onthoudt de huidige stream (voor retry/hervatten)
    function halt() {
        token++;
        clearTimeout(retryTimer);
        subsOn = false;
        if (av) {
            try { av.stop(); } catch (e) { /* negeren */ }
            try { av.close(); } catch (e) { /* negeren */ }
        } else if (video) {
            if (hls) { try { hls.destroy(); } catch (e) { /* negeren */ } hls = null; }
            video.onloadedmetadata = null;
            try { video.pause(); } catch (e) { /* negeren */ }
            video.removeAttribute('src');
            try { video.load(); } catch (e) { /* negeren */ }
        }
    }

    function stop() {
        if (!cur.url && state === 'idle') return;
        halt();
        cur = { url: null, opts: {} };
        suspended = null;
        emit('subtitle', '', 0);
        emit('buffering', false);
        setState('idle');
    }

    function pause() {
        if (state !== 'playing') return;
        if (av) { try { av.pause(); } catch (e) { return; } } else video.pause();
        setState('paused');
    }
    function resume() {
        if (state !== 'paused') return;
        if (av) { try { av.play(); } catch (e) { return; } } else video.play();
        setState('playing');
    }
    function toggle() { if (state === 'paused') resume(); else pause(); }

    function time() {
        if (av) { try { return av.getCurrentTime() || lastTime; } catch (e) { return lastTime; } }
        return video ? video.currentTime * 1000 : 0;
    }
    function duration() {
        if (av) { try { return av.getDuration() || 0; } catch (e) { return 0; } }
        return video && isFinite(video.duration) ? video.duration * 1000 : 0;
    }
    function seek(ms) {
        var d = duration();
        ms = Math.max(0, ms);
        if (d) ms = Math.min(ms, d - 2000);
        lastTime = ms;
        if (av) { try { av.seekTo(ms, noop, noop); } catch (e) { console.warn(e); } }
        else if (video) video.currentTime = ms / 1000;
    }

    // ---- Audio- en ondertitelsporen ----
    function extra(type, x) {
        if (type !== 'AUDIO') return '';
        var p = [];
        var ch = parseInt(x.channels, 10);
        if (ch) p.push(ch >= 6 ? '5.1' : ch === 2 ? 'stereo' : T('{n} kan.', { n: ch }));
        if (x.fourCC) p.push(String(x.fourCC).toUpperCase());
        return p.length ? ' (' + p.join(', ') + ')' : '';
    }

    function tracks(type) {
        var out = [], i;
        if (av) {
            var list = [];
            try { list = av.getTotalTrackInfo() || []; } catch (e) { /* nog niet klaar */ }
            for (i = 0; i < list.length; i++) {
                var t = list[i];
                if (t.type !== type) continue;
                var x = {};
                try { x = JSON.parse(t.extra_info || '{}'); } catch (e) { /* negeren */ }
                var raw = x.language || x.track_lang || '';
                out.push({ index: t.index, lang: U.normLang(raw), label: U.langLabel(raw) + extra(type, x) });
            }
            return out;
        }
        if (!video) return out;
        if (type === 'AUDIO' && video.audioTracks) {
            for (i = 0; i < video.audioTracks.length; i++) {
                var a = video.audioTracks[i];
                out.push({ index: i, lang: U.normLang(a.language), label: U.langLabel(a.language) + (a.label ? ' – ' + a.label : '') });
            }
        }
        if (type === 'TEXT' && video.textTracks) {
            for (i = 0; i < video.textTracks.length; i++) {
                var tt = video.textTracks[i];
                out.push({ index: i, lang: U.normLang(tt.language), label: U.langLabel(tt.language) + (tt.label ? ' – ' + tt.label : '') });
            }
        }
        return out;
    }

    function currentTrack(type) {
        var i;
        if (av) {
            try {
                var s = av.getCurrentStreamInfo() || [];
                for (i = 0; i < s.length; i++) if (s[i].type === type) return s[i].index;
            } catch (e) { /* negeren */ }
            return -1;
        }
        if (type === 'AUDIO' && video && video.audioTracks) for (i = 0; i < video.audioTracks.length; i++) if (video.audioTracks[i].enabled) return i;
        if (type === 'TEXT' && video && video.textTracks) for (i = 0; i < video.textTracks.length; i++) if (video.textTracks[i].mode === 'showing') return i;
        return -1;
    }

    function selectTrack(type, index) {
        var i;
        if (av) {
            try {
                av.setSelectTrack(type, index);
                if (type === 'TEXT') { av.setSilentSubtitle(false); subsOn = true; }
            } catch (e) { console.warn('Spoor kiezen mislukt', e); return false; }
            return true;
        }
        if (type === 'AUDIO' && video.audioTracks) for (i = 0; i < video.audioTracks.length; i++) video.audioTracks[i].enabled = i === index;
        if (type === 'TEXT' && video.textTracks) { for (i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = i === index ? 'showing' : 'disabled'; subsOn = true; }
        return true;
    }

    function subtitlesOff() {
        subsOn = false;
        if (av) { try { av.setSilentSubtitle(true); } catch (e) { /* negeren */ } }
        else if (video && video.textTracks) for (var i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = 'disabled';
        emit('subtitle', '', 0);
    }

    // Voorkeurstaal uit de instellingen toepassen
    // Voorkeurstalen: per stream meegegeven (bv. onthouden per serie), anders uit de instellingen
    // again = 1 of 2: nog eens kijken, want sommige streams (bv. MKV) melden hun ondertitels pas na een paar seconden.
    // Heeft de kijker zelf ondertitels gekozen (cur.userSubs), dan niets meer veranderen.
    function applyTrackPrefs(again) {
        var s = Store.settings(), c = cur, o = (c && c.opts) || {}, my = token;
        var aud = o.audioLang || s.audioLang, sub = o.subLang != null ? o.subLang : s.subLang;
        if (!again && aud && aud !== 'auto') {
            var a = tracks('AUDIO').filter(function (t) { return t.lang === aud; })[0];
            if (a && a.index !== currentTrack('AUDIO')) selectTrack('AUDIO', a.index);
        }
        if (c.userSubs || (again && subsOn)) return;
        var t = pickText(tracks('TEXT'), sub, o.live);
        if (t) { selectTrack('TEXT', t.index); return; }
        if (!again) subtitlesOff();
        if (sub !== 'off' && (again || 0) < 2) setTimeout(function () { if (my === token && cur === c) applyTrackPrefs((again || 0) + 1); }, again ? 5000 : 2500);
    }
    // Welke ondertiteling aan (of null = uit). sub: 'auto' = alleen als er precies één is, 'off', of een taal.
    // Bij een taal: niet gevonden, maar wel precies één ondertiteling zonder bekende taal ("Onbekend")? Dan die.
    // Nooit vanzelf bij live-zenders, behalve een gekozen taal.
    function pickText(text, sub, live) {
        if (!sub || sub === 'off') return null;
        if (sub === 'auto') return text.length === 1 && !live ? text[0] : null;
        var hit = text.filter(function (x) { return x.lang === sub; })[0];
        if (hit) return hit;
        return text.length === 1 && !live && /^(|und|unk|unknown|none|mis|zxx)$/.test(text[0].lang || '') ? text[0] : null;
    }

    // TV-app naar de achtergrond (bv. Home-knop): stream stoppen en daarna hervatten
    function onVisibility() {
        if (document.hidden) {
            if (cur.url && state !== 'idle' && state !== 'error') {
                suspended = { url: cur.url, opts: cur.opts, at: time() };
                halt();
            }
        } else if (suspended) {
            var s = suspended;
            suspended = null;
            play(s.url, Object.assign({}, s.opts, { startAt: s.opts.live ? 0 : s.at }));
        }
    }

    return {
        init: init, isNative: isNative, play: play, stop: stop, pause: pause, resume: resume, toggle: toggle,
        seek: seek, time: time, duration: duration, setRect: setRect, applyAspect: applyAspect,
        tracks: tracks, currentTrack: currentTrack, pickText: pickText,
        // Door de kijker gekozen (menu, externe ondertitels): daarna kiest de speler zelf niets meer
        selectTrack: function (type, index) { if (type === 'TEXT') cur.userSubs = true; return selectTrack(type, index); },
        subtitlesOff: function () { cur.userSubs = true; subtitlesOff(); },
        subtitlesActive: function () { return subsOn; },
        state: function () { return state; }, url: function () { return cur.url; }, meta: function () { return cur.opts.meta || null; },
        on: on, off: off
    };
})();
