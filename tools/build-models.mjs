// يجهّز مجسمات الشخصيات والحركات للعبة في ملف واحد assets/models.js (يعمل بفتح الملف مباشرة).
// المصدر: حزمتا Quaternius المجانيتان (CC0) في _downloads:
//   Universal Base Characters[Standard] و Universal Animation Library[Standard]
// - الشخصيات: نحذف الخامات الثقيلة (الألوان تُرسم في اللعبة حسب أجزاء الجسم) ونضمّ ملف bin داخل JSON.
// - الحركات: نختار ما تحتاجه اللعبة فقط ونحفظها مختصرة.
// الاستعمال: node game/tools/build-models.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const game = new URL('../', import.meta.url);
const dl = (p) => fileURLToPath(new URL('_downloads/' + p, game));
const UBC = 'ubc/Universal Base Characters[Standard]/';
const UAL = 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';

function slimGltf(path) {
  const g = JSON.parse(readFileSync(dl(path), 'utf8'));
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  g.buffers = g.buffers.map((b) => ({ byteLength: b.byteLength, uri: 'data:application/octet-stream;base64,' + readFileSync(dl(dir + b.uri)).toString('base64') }));
  // نُبقي خامة العين وحدها (صغيرة) حتى تظهر القزحية، ونحذف باقي الخامات الثقيلة
  const eyeMat = (g.materials || []).find((m) => /Eye/i.test(m.name));
  const eyeTex = eyeMat?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (eyeTex !== undefined) {
    const img = g.images[g.textures[eyeTex].source];
    const file = img.uri ? dir + decodeURIComponent(img.uri) : null;
    g.images = [{ uri: 'data:image/png;base64,' + readFileSync(dl(file)).toString('base64') }];
    g.textures = [{ source: 0, sampler: 0 }];
    g.samplers = [{}];
    eyeMat.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    delete eyeMat.normalTexture;
  } else { delete g.images; delete g.textures; delete g.samplers; }
  for (const m of g.materials || []) {
    if (m === eyeMat) continue;
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  return g;
}

const HAIR = UBC + 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/';
const out = {
  male: slimGltf(UBC + 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'),
  female: slimGltf(UBC + 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf'),
  hair: {},
  anims: [],
};
for (const h of ['Hair_SimpleParted', 'Hair_Long', 'Hair_Buzzed', 'Hair_Buns']) out.hair[h] = slimGltf(HAIR + h + '.gltf');

// الحركات
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
  'Interact', 'Dance_Loop', 'Idle_Talking_Loop', 'Hit_Chest', 'Sitting_Idle_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Walk_Formal_Loop', 'Roll'];
const buf = readFileSync(dl(UAL));
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
const round = (arr, d) => Array.from(arr, (v) => Math.round(v * d) / d);
for (const clip of gltf.animations) {
  if (!KEEP.includes(clip.name)) continue;
  const j = THREE.AnimationClip.toJSON(clip);
  for (const t of j.tracks) {
    t.times = round(t.times, 1000);
    t.values = round(t.values, 10000);
    // تبسيط: إزالة تحريك الموضع لكل العظام عدا الحوض (يبقى الطول ثابتًا مع أي حجم)
    if (t.name.endsWith('.position') && !/^(pelvis|root)/i.test(t.name)) t.drop = true;
  }
  j.tracks = j.tracks.filter((t) => !t.drop);
  out.anims.push(j);
}
console.log('clips', out.anims.map((a) => a.name).join(', '));
console.log('position tracks kept:', out.anims[0].tracks.filter((t) => t.name.endsWith('.position')).map((t) => t.name));
const js = '// مولَّد آليًا من tools/build-models.mjs — مجسمات Quaternius (CC0)\nwindow.MODELS = ' + JSON.stringify(out) + ';\n';
writeFileSync(new URL('assets/models.js', game), js);
console.log('assets/models.js', (js.length / 1048576).toFixed(1), 'MB');
