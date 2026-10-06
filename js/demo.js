/* Demo-modus: nep-Xtream-server om de app te testen zonder abonnement (server-URL "demo") */
var Demo = (function () {
    'use strict';

    // Op de TV (AVPlay) HLS-teststreams, waaronder Apple's voorbeeld met meerdere audio- en ondertitelsporen;
    // in de browser MP4, omdat desktop-Chrome HLS niet altijd zelf afspeelt
    var HLS = ['https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'];
    var MP4 = ['https://media.w3.org/2010/05/sintel/trailer.mp4', 'https://media.w3.org/2010/05/bunny/trailer.mp4',
        'https://cdn.jsdelivr.net/npm/big-buck-bunny-1080p@0.0.6/video.mp4', 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'];
    function src(id) {
        var list = Player.isNative() ? HLS : MP4;
        return list[Math.abs(parseInt(id, 10) || 0) % list.length];
    }
    function rnd(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
    function enc(s) { return btoa(unescape(encodeURIComponent(s))); }

    var liveCats = [
        { category_id: '1', category_name: 'NL | Algemeen' }, { category_id: '2', category_name: 'NL | Sport' },
        { category_id: '3', category_name: 'UK | Entertainment' }, { category_id: '4', category_name: 'Documentaires' },
        { category_id: '5', category_name: 'Kids' }
    ];
    var live = [];
    for (var i = 1; i <= 60; i++) {
        var c = liveCats[i % 5];
        live.push({ num: i, name: c.category_name.replace(/^.*\| /, '') + ' ' + i + (i % 7 === 0 ? ' HD' : ''), stream_type: 'live', stream_id: 1000 + i, stream_icon: '', category_id: c.category_id, epg_channel_id: 'demo' + i,
            tv_archive: (i % 3 === 0) ? 1 : 0, tv_archive_duration: (i % 3 === 0) ? '3' : '0' });
    }

    var SHOWS = ['Journaal', 'Weerbericht', 'Talkshow', 'Voetbal live', 'Natuurdocumentaire', 'Quiz', 'Film: De Reis',
        'Kookprogramma', 'Tekenfilms', 'Nieuwsuur', 'Reisprogramma', 'Muziekspecial', 'Formule 1', 'Wetenschap'];
    // Elke derde zender heeft een archief van 3 dagen (terugkijken); de korte EPG begint bij nu
    function hasArc(id) { return (id - 1000) % 3 === 0; }
    function epg(id, limit, full) {
        var day = new Date(); day.setHours(0, 0, 0, 0);
        var t = day.getTime() - (full ? 2 * 86400e3 : 0), now = Date.now(), out = [], n = 0;
        while (t < now + 36 * 3600e3 && out.length < limit) {
            var dur = (30 + Math.floor(rnd(id * 31 + n) * 5) * 15) * 60e3;
            if (full || t + dur > now) {
                var title = SHOWS[Math.floor(rnd(id * 7 + n) * SHOWS.length)];
                out.push({ title: enc(title), description: enc('Dit is demo-programma-informatie voor "' + title + '". Hier staat normaal de beschrijving uit de EPG van je provider.'),
                    start_timestamp: String(t / 1000), stop_timestamp: String((t + dur) / 1000), has_archive: hasArc(id) && t + dur <= now ? 1 : 0 });
            }
            t += dur; n++;
        }
        return { epg_listings: out };
    }

    var vodCats = [{ category_id: '10', category_name: 'Actie' }, { category_id: '11', category_name: 'Animatie' }, { category_id: '12', category_name: 'Sci-Fi' }, { category_id: '13', category_name: 'Documentaire' }];
    var OPEN = ['Big Buck Bunny', 'Elephants Dream', 'Sintel', 'Tears of Steel'];
    // Echte TMDB-id's zodat de TMDB-genres in de demo te testen zijn (o.a. The Shining, Alien, The Thing = horror)
    var MOVIE_TMDB = [10378, 9761, 45745, 133701, 694, 348, 603, 13, 12, 857, 680, 1091, 120, 11];
    var vod = [];
    for (i = 1; i <= 48; i++) {
        vod.push({ num: i, name: OPEN[i - 1] || ('Demofilm ' + i), stream_type: 'movie', stream_id: 5000 + i, stream_icon: '', rating: (5 + rnd(i) * 4).toFixed(1), category_id: vodCats[i % 4].category_id, container_extension: 'mp4', added: String(1700000000 + i * 1000), tmdb: String(MOVIE_TMDB[(i - 1) % MOVIE_TMDB.length]) });
    }

    var serCats = [{ category_id: '20', category_name: 'Drama' }, { category_id: '21', category_name: 'Comedy' }];
    var series = [];
    for (i = 1; i <= 16; i++) {
        series.push({ num: i, name: 'Demoserie ' + i, series_id: 8000 + i, tmdb: String([1402, 66732, 1399, 1396, 2316, 60574, 1405, 19885][i % 8]), cover: '', plot: 'Een demoserie om de app te testen.', genre: i % 2 ? 'Drama' : 'Comedy', rating: (6 + rnd(i + 99) * 3).toFixed(1), releaseDate: '2024-01-01', category_id: serCats[i % 2].category_id });
    }
    function seriesInfo(id) {
        var s = series.filter(function (x) { return String(x.series_id) === String(id); })[0] || series[0];
        var eps = {};
        [1, 2].forEach(function (sn) {
            eps[sn] = [];
            for (var e = 1; e <= 6; e++) {
                eps[sn].push({ id: String(id * 100 + sn * 10 + e), episode_num: e, title: 'Aflevering ' + e, container_extension: 'mp4', season: sn, info: { plot: 'Demo-aflevering ' + e + ' van seizoen ' + sn + '.', duration_secs: 600 + e * 30, movie_image: '' } });
            }
        });
        return { info: Object.assign({}, s), seasons: [{ season_number: 1, name: 'Seizoen 1' }, { season_number: 2, name: 'Seizoen 2' }], episodes: eps };
    }

    function byCat(list, cat) { return cat ? list.filter(function (x) { return String(x.category_id) === String(cat); }) : list; }

    function handle(p) {
        var res;
        switch (p.action) {
            case 'get_live_categories': res = liveCats; break;
            case 'get_live_streams': res = byCat(live, p.category_id); break;
            // Zoals veel echte providers: de korte EPG geeft er hooguit 4, de volledige tabel alles
            case 'get_short_epg': res = epg(+p.stream_id, Math.min(+p.limit || 4, 4)); break;
            case 'get_simple_data_table': res = epg(+p.stream_id, 400, true); break;
            case 'get_vod_categories': res = vodCats; break;
            case 'get_vod_streams': res = byCat(vod, p.category_id); break;
            case 'get_vod_info':
                var m = vod.filter(function (x) { return String(x.stream_id) === String(p.vod_id); })[0] || vod[0];
                res = { info: { plot: 'Een open-source film om de speler te testen. Beschrijving, cast en regisseur komen normaal van je provider.', genre: 'Animatie, Avontuur', releasedate: '2010-03-01', duration: '00:10:34', duration_secs: 634, rating: m.rating, director: 'Blender Foundation', cast: 'Diverse stemacteurs' }, movie_data: m };
                break;
            case 'get_series_categories': res = serCats; break;
            case 'get_series': res = byCat(series, p.category_id); break;
            case 'get_series_info': res = seriesInfo(p.series_id); break;
            default:
                res = {
                    user_info: { auth: 1, status: 'Active', username: 'demo', exp_date: String(Math.floor(Date.now() / 1000) + 86400 * 180), max_connections: '1', active_cons: '0', allowed_output_formats: ['m3u8', 'ts'] },
                    server_info: { url: 'demo', port: '80', timezone: 'Europe/Amsterdam' }
                };
        }
        return new Promise(function (resolve) { setTimeout(function () { resolve(JSON.parse(JSON.stringify(res))); }, 120); });
    }

    return { handle: handle, src: src };
})();
