// يصغّر صور الشخصيات ويضمّها في assets/sprites.js بصيغة data URI،
// حتى تعمل اللعبة بفتح index.html مباشرة (file://) دون خادم.
// الاستعمال: node game/tools/make-sprites.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decode, crc32 } from '../../character-refs/scripts/png.mjs';

const H = 640;
const here = new URL('..', import.meta.url);
const names = ['shtshout', 'shtshouta', 'mongia', 'salem', 'rashed', 'mazen', 'maryam', 'dana', 'noura'];

function encode(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = {};
for (const n of names) {
  const d = decode(readFileSync(new URL(`assets/${n}.png`, here)));
  const s = d.height / H, w = Math.round(d.width / s);
  const dst = Buffer.alloc(w * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
    // متوسط مربع من البكسلات مع ترجيح الشفافية (حتى لا تظهر هالة سوداء)
    const x0 = Math.floor(x * s), x1 = Math.min(d.width, Math.floor((x + 1) * s));
    const y0 = Math.floor(y * s), y1 = Math.min(d.height, Math.floor((y + 1) * s));
    let r = 0, g = 0, b = 0, a = 0, c = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * d.width + xx) * d.bpp, al = d.bpp === 4 ? d.px[i + 3] : 255;
      r += d.px[i] * al; g += d.px[i + 1] * al; b += d.px[i + 2] * al; a += al; c++;
    }
    const o = (y * w + x) * 4;
    if (a) { dst[o] = r / a; dst[o + 1] = g / a; dst[o + 2] = b / a; }
    dst[o + 3] = a / c;
  }
  out[n] = { w, h: H, src: 'data:image/png;base64,' + encode(w, H, dst).toString('base64') };
  console.log(n, w, H, Math.round(out[n].src.length / 1024) + 'KB');
}
writeFileSync(new URL('assets/sprites.js', here), '// مولَّد آليًا من tools/make-sprites.mjs — لا تعدّله يدويًا\nwindow.SPRITES = ' + JSON.stringify(out) + ';\n');
