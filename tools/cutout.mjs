// يزيل خلفية المربعات المطبوعة من صورة مرجعية (RGB) بالملء من الحواف، ويحفظ نسخة شفافة.
// الاستعمال: node game/tools/cutout.mjs <in.png> <out.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decode, crc32 } from '../../character-refs/scripts/png.mjs';

const [inp, out] = process.argv.slice(2);
const d = decode(readFileSync(inp));
const { width: w, height: h, bpp, px } = d;
const rgba = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  rgba[i * 4] = px[i * bpp]; rgba[i * 4 + 1] = px[i * bpp + 1]; rgba[i * 4 + 2] = px[i * bpp + 2];
  rgba[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255;
}
const isBg = (i) => {
  const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mn > (+process.env.BG_MIN || 175) && mx - mn < 28;
};
const bg = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !isBg(i)) continue;
  bg[i] = 1;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
}
// حافة ناعمة: البكسل الملاصق للخلفية يصير نصف شفاف
for (let i = 0; i < w * h; i++) {
  if (bg[i]) { rgba[i * 4 + 3] = 0; continue; }
  const x = i % w, y = (i / w) | 0;
  let n = 0;
  for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && bg[j]) n++;
  if (n) rgba[i * 4 + 3] = 140;
}
const raw = Buffer.alloc(h * (w * 4 + 1));
for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
const chunk = (type, data) => {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('ok', out, w, h);
