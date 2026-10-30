// قص خلفية أدق من cutout.mjs: يملأ من الحواف ويتوقف عند أي تغيّر حادّ في اللون (حافة الشخصية)،
// فينجح مع الخلفيات الملوّنة المتدرّجة ولا يأكل الأبيض داخل الشخصية (الجوارب، الحجاب).
// الاستعمال: node game/tools/cutout2.mjs <in.png> <out.png> [حدّ الفرق بين جارين، افتراضيًا 7]
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decode, crc32 } from '../../character-refs/scripts/png.mjs';

const [inp, out, tArg] = process.argv.slice(2);
const T = +(tArg || 7);
const d = decode(readFileSync(inp));
const { width: w, height: h, bpp, px } = d;
const rgba = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  rgba[i * 4] = px[i * bpp]; rgba[i * 4 + 1] = px[i * bpp + 1]; rgba[i * 4 + 2] = px[i * bpp + 2];
  rgba[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255;
}
const diff = (a, b) => Math.max(Math.abs(rgba[a * 4] - rgba[b * 4]), Math.abs(rgba[a * 4 + 1] - rgba[b * 4 + 1]), Math.abs(rgba[a * 4 + 2] - rgba[b * 4 + 2]));
const SAT = +(process.argv[5] || 255);
const light = (i) => { const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]; return Math.min(r, g, b) > 140 && Math.max(r, g, b) - Math.min(r, g, b) <= SAT; };
const bg = new Uint8Array(w * h);
const stack = [];
const seed = (i) => { if (!bg[i] && light(i)) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
while (stack.length) {
  const i = stack.pop();
  const x = i % w, y = (i / w) | 0;
  for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
    if (j < 0 || bg[j] || !light(j) || diff(i, j) > T) continue;
    bg[j] = 1; stack.push(j);
  }
}
// تنعيم الحافة: البكسل الملاصق للخلفية يصير نصف شفاف
for (let i = 0; i < w * h; i++) {
  if (bg[i]) { rgba[i * 4 + 3] = 0; continue; }
  const x = i % w, y = (i / w) | 0;
  let n = 0;
  if (x > 0 && bg[i - 1]) n++; if (x < w - 1 && bg[i + 1]) n++; if (y > 0 && bg[i - w]) n++; if (y < h - 1 && bg[i + w]) n++;
  if (n >= 2) rgba[i * 4 + 3] = 140;
}
const raw = Buffer.alloc(h * (w * 4 + 1));
for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
const chunk = (type, data) => {
  const hd = Buffer.alloc(8); hd.writeUInt32BE(data.length, 0); hd.write(type, 4, 'ascii');
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([hd.subarray(4), data])), 0);
  return Buffer.concat([hd, data, c]);
};
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('ok', out, w, h);
