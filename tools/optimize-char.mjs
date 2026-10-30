// يصغّر ملف شخصية من Meshy للعبة (أجهزة المدرسة):
// - يحذف خامتي normal وmetallicRoughness (لا تُرى تقريبًا بإضاءة اللعبة الكرتونية)
// - يحوّل خامة اللون إلى JPEG بعرض 1024 بواسطة ffmpeg
// الهيكل العظمي والحركات تبقى كما هي.
// الاستعمال: node tools/optimize-char.mjs salem   (يقرأ assets/chars/raw/salem.glb ويكتب assets/chars/salem.glb)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
const texW = +(process.argv[3] || 1024);   // عرض خامة اللون: 2048 للشخصيات التي تُرى وجوهها عن قرب
const game = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(join(game, 'assets/chars/raw', name + '.glb'));

const jsonLen = src.readUInt32LE(12);
const j = JSON.parse(src.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = src.subarray(binStart, binStart + src.readUInt32LE(20 + jsonLen));

const viewBytes = (i) => { const v = j.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };

// الخامة المستعملة للون فقط
const mat = j.materials[0];
delete mat.normalTexture;
if (mat.pbrMetallicRoughness) {
  delete mat.pbrMetallicRoughness.metallicRoughnessTexture;
  mat.pbrMetallicRoughness.metallicFactor = 0;
  mat.pbrMetallicRoughness.roughnessFactor = 0.9;
}
const texIdx = mat.pbrMetallicRoughness.baseColorTexture.index;
const imgIdx = j.textures[texIdx].source;

// تحويل صورة اللون إلى JPEG 1024
const dir = mkdtempSync(join(tmpdir(), 'char-'));
writeFileSync(join(dir, 'in.png'), viewBytes(j.images[imgIdx].bufferView));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(dir, 'in.png'), '-vf', 'scale=' + texW + ':-1', '-q:v', '2', join(dir, 'out.jpg')]);
const jpg = readFileSync(join(dir, 'out.jpg'));
rmSync(dir, { recursive: true });

// تخفيف الهندسة (اللعبة ترسم الشخصيات بلا إضاءة، فلا تحتاج المتجهات العمودية):
// - نحذف NORMAL
// - نحوّل أوزان الهيكل من أعداد عشرية (16 بايت) إلى بايتات (4 بايت)
const viewUsers = new Map();
for (const a of j.accessors) if (a.bufferView !== undefined) viewUsers.set(a.bufferView, (viewUsers.get(a.bufferView) || 0) + 1);
const dropViews = new Set();
const newViews = [];   // { acc, bytes }
for (const m of j.meshes) for (const p of m.primitives) {
  const ni = p.attributes.NORMAL;
  if (ni !== undefined) {
    const a = j.accessors[ni];
    if (viewUsers.get(a.bufferView) === 1) { dropViews.add(a.bufferView); delete a.bufferView; delete a.byteOffset; }
    delete p.attributes.NORMAL;
  }
  const wi = p.attributes.WEIGHTS_0;
  if (wi === undefined) continue;
  const a = j.accessors[wi];
  if (a.componentType !== 5126 || viewUsers.get(a.bufferView) !== 1) continue;
  const v = j.bufferViews[a.bufferView], src = viewBytes(a.bufferView), stride = v.byteStride || 16, base = a.byteOffset || 0;
  const u = Buffer.alloc(a.count * 4);
  for (let i = 0; i < a.count; i++) {
    const q = [0, 1, 2, 3].map((k) => Math.max(0, Math.round(src.readFloatLE(base + i * stride + k * 4) * 255)));
    const big = q.indexOf(Math.max(...q));
    q[big] = Math.max(0, q[big] + 255 - q.reduce((s, x) => s + x, 0));   // مجموع الأوزان 255 بالضبط
    u.set(q, i * 4);
  }
  dropViews.add(a.bufferView); delete a.bufferView; delete a.byteOffset;
  a.componentType = 5121; a.normalized = true;
  newViews.push({ acc: a, bytes: u });
}

// إعادة بناء البيانات الثنائية: كل bufferView ما عدا الصور، ثم صورة اللون الجديدة
const keepViews = new Map();
const parts = [];
let off = 0;
const pad = () => { const p = (4 - (off % 4)) % 4; if (p) { parts.push(Buffer.alloc(p)); off += p; } };
const imageViews = new Set(j.images.map((im) => im.bufferView));
j.bufferViews.forEach((v, i) => {
  if (imageViews.has(i) || dropViews.has(i)) return;
  pad();
  const bytes = viewBytes(i);
  keepViews.set(i, { ...v, byteOffset: off });
  parts.push(bytes); off += bytes.length;
});
pad();
const extraAt = newViews.map((nv) => { pad(); const at = off; parts.push(nv.bytes); off += nv.bytes.length; return at; });
pad();
const jpgView = { buffer: 0, byteOffset: off, byteLength: jpg.length };
parts.push(jpg); off += jpg.length;
pad();

// ترقيم bufferViews من جديد
const remap = new Map();
const views = [];
for (const [old, v] of keepViews) { remap.set(old, views.length); views.push(v); }
const jpgViewIdx = views.length; views.push(jpgView);
j.bufferViews = views;
for (const a of j.accessors) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
newViews.forEach((nv, k) => { nv.acc.bufferView = views.length; views.push({ buffer: 0, byteOffset: extraAt[k], byteLength: nv.bytes.length }); });
j.images = [{ bufferView: jpgViewIdx, mimeType: 'image/jpeg' }];
j.textures = [{ source: 0, sampler: j.textures[texIdx].sampler }];
mat.pbrMetallicRoughness.baseColorTexture = { index: 0 };
j.buffers = [{ byteLength: off }];

const binOut = Buffer.concat(parts);
let jsonBuf = Buffer.from(JSON.stringify(j));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binOut.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const out = Buffer.concat([header, ch(jsonBuf.length, 0x4e4f534a), jsonBuf, ch(binOut.length, 0x004e4942), binOut]);
writeFileSync(join(game, 'assets/chars', name + '.glb'), out);
console.log(name, (src.length / 1048576).toFixed(1) + 'MB →', (out.length / 1048576).toFixed(1) + 'MB', 'anims:', (j.animations || []).map((a) => a.name).join(','));

// نسخة .js من الملف نفسه (base64) حتى تعمل اللعبة عند فتحها مباشرة ومن رابط المعاينة
writeFileSync(join(game, 'assets/chars', name + '.js'),
  `// مولَّد آليًا من tools/optimize-char.mjs\n(window.CHAR_GLB = window.CHAR_GLB || {})[${JSON.stringify(name)}] = "${out.toString('base64')}";\n`);
