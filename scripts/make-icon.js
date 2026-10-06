// Genereert icon.png (512x423, Samsung TV-formaat): een kartonnen doosje met ogen
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const W = 512, H = 423, SS = 4;

function inRoundRect(x, y, x0, y0, x1, y1, r) {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inEllipse(x, y, cx, cy, rx, ry) { return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1; }
function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255]; }
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

const WHITE = hex('#ffffff'), INK = hex('#1e1b4b');
const BOX = hex('#f2a93b'), BOX_DARK = hex('#d98a1f'), LID = hex('#f9c870'), FLAP = hex('#e8992c'), TAPE = hex('#f6d9a4');

// Kleur per subpixel: [r, g, b, a]
function sample(x, y) {
    if (!inRoundRect(x, y, 0, 0, W, H, 84)) return [0, 0, 0, 0];
    // Achtergrond: blauw -> paars, zoals de app
    const t = (x / W + y / H) / 2;
    let c = mix(hex('#3b82f6'), hex('#7c3aed'), t);

    // Schaduw onder de doos
    if (inEllipse(x, y, 256, 366, 150, 16)) c = mix(c, hex('#1e1b4b'), 0.35);

    // Open flappen (achter het deksel)
    if (inPoly(x, y, [[150, 150], [116, 92], [196, 104], [206, 150]])) c = FLAP;
    if (inPoly(x, y, [[362, 150], [396, 92], [316, 104], [306, 150]])) c = FLAP;

    // Bovenkant (perspectief) en voorkant
    if (inPoly(x, y, [[134, 176], [378, 176], [352, 142], [160, 142]])) c = LID;
    if (inRoundRect(x, y, 134, 172, 378, 360, 16)) {
        c = mix(BOX, BOX_DARK, (y - 172) / 188);
        // Plakband-streep bovenaan
        if (y < 196 && x > 226 && x < 286) c = TAPE;
    }

    // Ogen: wit, pupil (kijkt iets naar rechtsonder) en een glimlichtje
    const eyes = [[204, 262], [308, 262]];
    for (const [ex, ey] of eyes) {
        if (inEllipse(x, y, ex, ey, 40, 46)) c = WHITE;
        if (inEllipse(x, y, ex + 8, ey + 8, 20, 22)) c = INK;
        if (inEllipse(x, y, ex + 15, ey - 1, 7, 7)) c = WHITE;
    }

    // Glimlach: dikke boog onder de ogen
    const d = Math.hypot(x - 256, y - 300);
    if (y > 318 && d > 26 && d < 36 && Math.abs(x - 256) < 26) c = INK;
    return c;
}

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
            const p = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
            r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
        }
        const o = y * (W * 4 + 1) + 1 + x * 4;
        raw[o] = a ? Math.round(r / a) : 0; raw[o + 1] = a ? Math.round(g / a) : 0; raw[o + 2] = a ? Math.round(b / a) : 0;
        raw[o + 3] = Math.round(a / (SS * SS));
    }
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname, '..', 'icon.png'), png);
console.log('icon.png geschreven (' + png.length + ' bytes)');
