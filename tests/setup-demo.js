// Demo-profiel met wat kijkgeschiedenis, Mijn lijst en een favoriete zender (voor tests via tests/drive.mjs).
// Zet window.__m (The Matrix) en window.__s (Game of Thrones) klaar.
(async function () {
    localStorage.clear();
    var p = { id: 'demo1', name: 'Demo', server: 'demo', username: '', password: '' };
    Store.saveProfile(p); Store.setActive('demo1'); Api.setProfile(p); await Api.login();
    var vs = await Api.vodStreams(null), ss = await Api.series(null), ls = await Api.liveStreams();
    var pick = function (list, id, i) { return list.filter(function (x) { return String(x.tmdb) === id; })[0] || list[i]; };
    var m = pick(vs, '603', 0), m2 = pick(vs, '694', 1), s = pick(ss, '1399', 0), s2 = pick(ss, '1402', 1);
    Store.saveProgress({ key: 'movie:' + m2.stream_id, mode: 'movie', id: String(m2.stream_id), name: m2.name, icon: m2.stream_icon, tmdb: m2.tmdb, ext: 'mp4', position: 2400, duration: 6000 });
    Store.saveProgress({ key: 'episode:9001', mode: 'episode', id: '9001', name: 'Aflevering 3', icon: '', ext: 'mp4', position: 900, duration: 3300, season: 1, episode: 3,
        series: { id: String(s.series_id), name: s.name, icon: s.cover, tmdb: s.tmdb } });
    Store.saveProgress({ key: 'movie:' + m.stream_id, mode: 'movie', id: String(m.stream_id), name: m.name, icon: m.stream_icon, tmdb: m.tmdb, ext: 'mp4', position: 3000, duration: 8000 });
    if (!Store.isFav('movie', m.stream_id)) Store.toggleFav('movie', App.favFromVod(m));
    if (!Store.isFav('series', s2.series_id)) Store.toggleFav('series', App.favFromSeries(s2));
    if (!Store.isFav('live', ls[0].stream_id)) Store.toggleFav('live', App.favFromCh(ls[0]));
    window.__m = m; window.__s = s;
    App.reset('home');
    return 'ok';
})()
