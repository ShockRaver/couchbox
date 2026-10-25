/* Gzip uitpakken in JavaScript (DEFLATE, RFC 1951/1952), voor oudere TV's zonder DecompressionStream (Chromium < 80).
   Nieuwere TV's gebruiken de ingebouwde DecompressionStream; dit bestand wordt daar niet aangeroepen.
   Werkt op het hele bestand in één keer: Inflate.gunzip(Uint8Array) -> Uint8Array. Gebaseerd op het ontwerp van tinf/tiny-inflate. */
var Inflate = (function () {
    'use strict';

    function Tree() { this.table = new Uint16Array(16); this.trans = new Uint16Array(288); }

    var sltree = new Tree(), sdtree = new Tree(), codeTree = new Tree();
    var lengthBits = new Uint8Array(30), lengthBase = new Uint16Array(30), distBits = new Uint8Array(30), distBase = new Uint16Array(30);
    var clcidx = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    var lengths = new Uint8Array(288 + 32), offs = new Uint16Array(16);

    // Extra bits en basiswaarden voor lengtes en afstanden
    function bitsBase(bits, base, delta, first) {
        var i, sum;
        for (i = 0; i < delta; i++) bits[i] = 0;
        for (i = 0; i < 30 - delta; i++) bits[i + delta] = (i / delta) | 0;
        for (sum = first, i = 0; i < 30; i++) { base[i] = sum; sum += 1 << bits[i]; }
    }
    // Vaste Huffman-bomen (bloktype 1)
    function fixedTrees(lt, dt) {
        var i;
        for (i = 0; i < 7; i++) lt.table[i] = 0;
        lt.table[7] = 24; lt.table[8] = 152; lt.table[9] = 112;
        for (i = 0; i < 24; i++) lt.trans[i] = 256 + i;
        for (i = 0; i < 144; i++) lt.trans[24 + i] = i;
        for (i = 0; i < 8; i++) lt.trans[24 + 144 + i] = 280 + i;
        for (i = 0; i < 112; i++) lt.trans[24 + 144 + 8 + i] = 144 + i;
        for (i = 0; i < 5; i++) dt.table[i] = 0;
        dt.table[5] = 32;
        for (i = 0; i < 32; i++) dt.trans[i] = i;
    }
    // Boom opbouwen uit codelengtes
    function buildTree(t, lens, off, num) {
        var i, sum;
        for (i = 0; i < 16; i++) t.table[i] = 0;
        for (i = 0; i < num; i++) t.table[lens[off + i]]++;
        t.table[0] = 0;
        for (sum = 0, i = 0; i < 16; i++) { offs[i] = sum; sum += t.table[i]; }
        for (i = 0; i < num; i++) if (lens[off + i]) t.trans[offs[lens[off + i]]++] = i;
    }

    bitsBase(lengthBits, lengthBase, 4, 3);
    bitsBase(distBits, distBase, 2, 1);
    lengthBits[28] = 0; lengthBase[28] = 258;
    fixedTrees(sltree, sdtree);

    // ---- Bits lezen (d = { src, i, tag, bitcount, dest, n }) ----
    function getbit(d) {
        if (!d.bitcount--) { d.tag = d.src[d.i++] | 0; d.bitcount = 7; }
        var bit = d.tag & 1;
        d.tag >>>= 1;
        return bit;
    }
    function readBits(d, num, base) {
        if (!num) return base;
        while (d.bitcount < 24) { d.tag |= (d.src[d.i++] | 0) << d.bitcount; d.bitcount += 8; }
        var val = d.tag & (0xffff >>> (16 - num));
        d.tag >>>= num;
        d.bitcount -= num;
        return val + base;
    }
    function decodeSym(d, t) {
        while (d.bitcount < 24) { d.tag |= (d.src[d.i++] | 0) << d.bitcount; d.bitcount += 8; }
        var sum = 0, cur = 0, len = 0, tag = d.tag;
        do {
            cur = 2 * cur + (tag & 1);
            tag >>>= 1;
            ++len;
            sum += t.table[len];
            cur -= t.table[len];
        } while (cur >= 0 && len < 16);
        d.tag = tag;
        d.bitcount -= len;
        return t.trans[sum + cur];
    }

    // Dynamische bomen (bloktype 2)
    function decodeTrees(d, lt, dt) {
        var hlit = readBits(d, 5, 257), hdist = readBits(d, 5, 1), hclen = readBits(d, 4, 4), i, num, len, prev;
        for (i = 0; i < 19; i++) lengths[i] = 0;
        for (i = 0; i < hclen; i++) lengths[clcidx[i]] = readBits(d, 3, 0);
        buildTree(codeTree, lengths, 0, 19);
        for (num = 0; num < hlit + hdist;) {
            var sym = decodeSym(d, codeTree);
            if (sym === 16) { prev = lengths[num - 1]; for (len = readBits(d, 2, 3); len; --len) lengths[num++] = prev; }
            else if (sym === 17) { for (len = readBits(d, 3, 3); len; --len) lengths[num++] = 0; }
            else if (sym === 18) { for (len = readBits(d, 7, 11); len; --len) lengths[num++] = 0; }
            else lengths[num++] = sym;
        }
        buildTree(lt, lengths, 0, hlit);
        buildTree(dt, lengths, hlit, hdist);
    }

    function inflateBlock(d, lt, dt) {
        for (;;) {
            var sym = decodeSym(d, lt);
            if (sym === 256) return;
            if (sym < 256) { d.dest[d.n++] = sym; continue; }
            sym -= 257;
            var len = readBits(d, lengthBits[sym], lengthBase[sym]), dist = decodeSym(d, dt);
            var from = d.n - readBits(d, distBits[dist], distBase[dist]);
            if (from < 0) throw new Error('inflate: ongeldige afstand');
            for (var i = from; i < from + len; ++i) d.dest[d.n++] = d.dest[i];
        }
    }
    // Niet-gecomprimeerd blok (bloktype 0)
    function storedBlock(d) {
        while (d.bitcount > 8) { d.i--; d.bitcount -= 8; }
        var len = d.src[d.i + 1] * 256 + d.src[d.i], inv = d.src[d.i + 3] * 256 + d.src[d.i + 2];
        if (len !== (~inv & 0xffff)) throw new Error('inflate: ongeldig blok');
        d.i += 4;
        for (var i = len; i; --i) d.dest[d.n++] = d.src[d.i++];
        d.bitcount = 0;
        d.tag = 0;
    }

    // Ruwe DEFLATE-gegevens uitpakken in dest; geeft het aantal bytes
    function inflateRaw(src, dest) {
        var d = { src: src, i: 0, tag: 0, bitcount: 0, dest: dest, n: 0 }, last, type, lt = new Tree(), dt = new Tree();
        do {
            last = getbit(d);
            type = readBits(d, 2, 0);
            if (type === 0) storedBlock(d);
            else if (type === 1) inflateBlock(d, sltree, sdtree);
            else if (type === 2) { decodeTrees(d, lt, dt); inflateBlock(d, lt, dt); }
            else throw new Error('inflate: ongeldig bloktype');
        } while (!last);
        return d.n;
    }

    // Gzip-bestand (kop, DEFLATE-gegevens, CRC en lengte) uitpakken
    function gunzip(src) {
        if (src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error('inflate: geen gzip');
        var flg = src[3], i = 10;
        if (flg & 4) i += 2 + (src[i] | (src[i + 1] << 8));
        if (flg & 8) while (src[i++]) { /* bestandsnaam */ }
        if (flg & 16) while (src[i++]) { /* commentaar */ }
        if (flg & 2) i += 2;
        var n = src.length, size = (src[n - 4] | (src[n - 3] << 8) | (src[n - 2] << 16) | (src[n - 1] << 24)) >>> 0;
        var dest = new Uint8Array(size), got = inflateRaw(src.subarray(i, n - 8), dest);
        return got === size ? dest : dest.subarray(0, got);
    }

    return { gunzip: gunzip, inflateRaw: inflateRaw };
})();
