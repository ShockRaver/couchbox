/* Afstandsbediening: keycodes vertalen naar namen en Tizen-toetsen registreren */
var Keys = (function () {
    'use strict';

    var MAP = {
        13: 'ok', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
        10009: 'back', 27: 'back', 8: 'back', 10182: 'exit',
        415: 'play', 19: 'pause', 10252: 'playpause', 413: 'stop', 417: 'ff', 412: 'rw',
        403: 'red', 404: 'green', 405: 'yellow', 406: 'blue',
        427: 'chup', 428: 'chdown', 10190: 'prech', 457: 'info', 458: 'guide',
        65376: 'done', 65385: 'cancel',
        // Sneltoetsen om in een desktopbrowser te testen
        32: 'playpause', 33: 'chup', 34: 'chdown', 112: 'red', 113: 'green', 114: 'yellow', 115: 'blue', 73: 'info', 71: 'guide'
    };
    for (var i = 0; i <= 9; i++) { MAP[48 + i] = String(i); MAP[96 + i] = String(i); }

    // Toetsen die we expliciet moeten aanvragen bij Tizen (pijlen/OK/terug krijgt elke app standaard)
    var WANTED = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown',
        'PreviousChannel', 'Info', 'Guide', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    function register() {
        if (!window.tizen || !tizen.tvinputdevice) return;
        var supported = {};
        try { tizen.tvinputdevice.getSupportedKeys().forEach(function (k) { supported[k.name] = true; }); } catch (e) { /* negeren */ }
        var check = Object.keys(supported).length > 0;
        WANTED.forEach(function (n) {
            if (check && !supported[n]) return;
            try { tizen.tvinputdevice.registerKey(n); } catch (e) { console.warn('Toets niet geregistreerd', n); }
        });
    }

    function name(e) { return MAP[e.keyCode] || null; }
    function isDigit(k) { return typeof k === 'string' && k.length === 1 && k >= '0' && k <= '9'; }

    return { register: register, name: name, isDigit: isDigit };
})();
