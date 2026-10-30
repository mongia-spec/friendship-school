// مدرسة الأصدقاء – سرّ الكتاب المخفي
// المستوى الأول: الساحة + المكتبة المسحورة. كل النصوص في content/level1.js.
(() => {
'use strict';
const C = window.GAME_CONTENT, S = window.SPRITES;
const RC = window.ROOMS_CONTENT || {}, RX = window.ROOMS_EXTRA || { order: [] };
// الطلاب الخمسة المحتجزون في غرف الوحوش (سالم في المكتبة)
const STUDENTS = { rashed: 'راشد', mazen: 'مازن', maryam: 'مريم', dana: 'دانة', noura: 'نورة' };
Object.assign(C.names, STUDENTS);
const ALL_OPEN = /[?&]all/.test(location.search);    // للمعلّمة: فتح كل الغرف للتجربة
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const PI = Math.PI;
const LX = 200;                       // المكتبة مبنية بعيدًا عن الساحة على المحور x
const SAVE_KEY = 'friendship-school-v1';
const FONT = 'Tajawal, Tahoma, Arial, sans-serif';
const isTouch = window.matchMedia('(pointer: coarse)').matches || /[?&]touch\b/.test(location.search);
if (isTouch) document.body.classList.add('touch');

/* ---------------- الحالة العامة ---------------- */
const G = {
  stage: 'intro', hero: 'boy', area: 'yard', lock: 1, paused: false, playing: false, busy: false,
  cam: null, camYaw: 0, camDist: 6.5, camPitch: 0.42,
  energy: 100, kidnapped: false, vitamins: false, stars: new Set(), skills: {}, cleared: new Set(), pages: 0, health: 100, round: 0, spellIdx: 0, wrongTiles: 0, time: 0,
};
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ stage: G.stage, stars: [...G.stars], skills: G.skills, energy: G.energy, wordsDone: G.wordsDone, kidnapped: G.kidnapped, vitamins: G.vitamins, cleared: [...G.cleared], hero: G.hero, grade: G.grade, name: G.name })); } catch (e) { /* لا شيء */ }
}

/* ---------------- المحرك ---------------- */
const canvas = $('view');
function makeRenderer() {
  try { return new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) {
    // المتصفح رفض الرسوم ثلاثية الأبعاد: نخبر التلميذ بدل أن تبقى شاشة التحميل بلا نهاية
    $('loading').querySelector('.spinner').style.display = 'none';
    $('loading').querySelector('p').textContent = 'تعذّر تشغيل الرسوم ثلاثية الأبعاد في هذا المتصفح. يُرجى إغلاق المتصفح تمامًا وفتحه من جديد، أو تجربة متصفح آخر.';
    throw e;
  }
}
const renderer = makeRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 0.8 ? 75 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 0.85);
const sun = new THREE.DirectionalLight(0xfff2d6, 0.75);
sun.position.set(-30, 50, 20);
scene.add(hemi, sun);

const matCache = {};
function mat(color, extra) {
  if (extra) return new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
  return matCache[color] || (matCache[color] = new THREE.MeshLambertMaterial({ color }));
}
function mesh(geo, material, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const box = (w, h, d, c, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, p);
const sphere = (r, c, x, y, z, p, seg = 16) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), c, x, y, z, p);
const cyl = (rt, rb, h, c, x, y, z, p, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, p);

/* التصادم: مستطيلات على الأرض */
const colliders = [];
function addCol(minX, maxX, minZ, maxZ) {
  const c = { minX, maxX, minZ, maxZ, on: true };
  colliders.push(c);
  return c;
}
function solid(w, h, d, color, x, y, z) {   // صندوق مرئي يصطدم به اللاعب والكاميرا
  const m = box(w, h, d, color, x, y, z);
  addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  camBlockers.push(m);
  return m;
}
const camBlockers = [];
function collide(pos, r) {
  for (const c of colliders) {
    if (!c.on) continue;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = cx + dx / d * r; pos.z = cz + dz / d * r;
    } else {                                  // داخل الصندوق: أقصر طريق للخروج
      const opts = [[pos.x - c.minX + r, -1, 0], [c.maxX - pos.x + r, 1, 0], [pos.z - c.minZ + r, 0, -1], [c.maxZ - pos.z + r, 0, 1]];
      opts.sort((a, b) => a[0] - b[0]);
      pos.x += opts[0][1] * opts[0][0]; pos.z += opts[0][2] * opts[0][0];
    }
  }
}
function lineBlocked(a, b) {                 // هل يقطع رفٌّ خطَّ النظر؟
  const steps = Math.ceil(a.distanceTo(b) / 0.5);
  const p = new V3();
  for (let i = 1; i < steps; i++) {
    p.lerpVectors(a, b, i / steps);
    for (const c of colliders) if (c.on && c.sight !== false && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ) return true;
  }
  return false;
}

/* ---------------- نصوص عربية على لوحات ---------------- */
function wrapLines(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function textCanvas(text, o = {}) {
  const size = o.size || 64, pad = o.pad ?? 26, weight = o.weight || 900;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size}px ${FONT}`;
  g.font = font;
  const lines = wrapLines(g, text, o.maxW || 1100);
  const lh = size * 1.45;
  const w = Math.ceil(Math.max(o.minW || 0, ...lines.map((l) => g.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lines.length * lh + pad * 1.2);
  c.width = w; c.height = h;
  g.font = font;
  if (o.bg) {
    const r = o.radius ?? Math.min(36, h / 2);
    g.fillStyle = o.bg;
    g.beginPath();
    g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r);
    g.fill();
    if (o.border) { g.lineWidth = 8; g.strokeStyle = o.border; g.stroke(); }
  }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const y = pad * 0.6 + lh * (i + 0.5);
    if (o.stroke) { g.lineWidth = size * 0.16; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(l, w / 2, y); }
    g.fillStyle = o.color || '#2a1f4d';
    g.fillText(l, w / 2, y);
  });
  return c;
}
function label(text, height, o = {}, parent = scene) {
  const c = textCanvas(text, Object.assign({ bg: 'rgba(255,250,240,0.95)', border: '#8e5cf7' }, o));
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest ?? true }));
  sp.scale.set(height * c.width / c.height, height, 1);
  sp.userData.h = height; sp.userData.o = o;
  parent.add(sp);
  return sp;
}
function setLabel(sp, text) {
  const c = textCanvas(text, Object.assign({ bg: 'rgba(255,250,240,0.95)', border: '#8e5cf7' }, sp.userData.o));
  sp.material.map.dispose();
  sp.material.map = new THREE.CanvasTexture(c);
  sp.scale.set(sp.userData.h * c.width / c.height, sp.userData.h, 1);
}
function signPlane(text, width, o = {}, parent = scene) {   // لوحة مسطحة على جدار
  const c = textCanvas(text, o);
  const h = width * c.height / c.width;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  parent.add(m);
  return m;
}

/* ---------------- مؤثرات ---------------- */
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const particles = [];
function burst(pos, color = 0xffd23f, n = 18, speed = 4, size = 0.35) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    const v = new V3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
    scene.add(sp);
    particles.push({ sp, v, life: 0.7 + Math.random() * 0.5, age: 0 });
  }
}
function glow(color, size, parent) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.setScalar(size);
  parent.add(sp);
  return sp;
}
function blob(parent, r = 0.5) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  m.rotation.x = -PI / 2; m.position.y = 0.03;
  parent.add(m);
  return m;
}

/* ---------------- حركات زمنية ---------------- */
const tweens = [];
function tween(dur, fn) {
  return new Promise((res) => tweens.push({ t: 0, dur, fn, res }));
}
const wait = (s) => tween(s, () => {});
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function camTo(pos, look, dur = 1.2) {
  G.cam = { pos: pos.clone(), look: look.clone(), speed: 3 };
  return wait(dur);
}
async function fade(on, dark = false) {
  const f = $('fade');
  f.classList.toggle('dark', dark);
  f.classList.toggle('on', on);
  await wait(0.4);
}

/* ---------------- الشخصيات ---------------- */
const texLoader = new THREE.TextureLoader();
function charSprite(key, height) {            // صورة الشخصية المرجعية كما هي، تواجه الكاميرا دائمًا
  const info = S[key];
  const w = height * info.w / info.h;
  const geo = new THREE.PlaneGeometry(w, height);
  geo.translate(0, height / 2, 0);
  const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLoader.load(info.src), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(plane);
  blob(g, w * 0.4);
  g.userData.plane = plane;
  g.userData.billboard = true;
  g.userData.key = key;
  scene.add(g);
  upgradeToGLB(g, C.models && C.models[key], height);
  return g;
}
// شخصية ثلاثية الأبعاد متحركة من Meshy (هيكل Mixamo، حركتا Walking وRunning).
// تُحمَّل في الخلفية وتحلّ محل الصورة المسطحة؛ إن فشل التحميل (مثل فتح الملف مباشرة) تبقى الصورة.
const glbLoader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
const glbChars = [];
// الملف assets/chars/<name>.js يحمل الشخصية بصيغة base64، فيعمل حتى عند فتح index.html مباشرة
// أولًا الملف الثنائي assets/chars/<name>.glb (أخف بالربع)، وإن تعذّر (مثل فتح الملف مباشرة) فنسخة .js
function loadCharData(url) {
  if (location.protocol === 'file:') return loadCharScript(url).then(b64ToBuf);
  return fetch(url.replace(/\.js$/, '.glb')).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .catch(() => loadCharScript(url).then(b64ToBuf));
}
const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
function loadCharScript(url) {
  return new Promise((res, rej) => {
    const key = url.split('/').pop().replace(/\.js$/, '');
    if (window.CHAR_GLB && window.CHAR_GLB[key]) return res(window.CHAR_GLB[key]);
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => (window.CHAR_GLB && window.CHAR_GLB[key] ? res(window.CHAR_GLB[key]) : rej());
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
function upgradeToGLB(group, url, height) {
  if (!glbLoader || !url) return;
  loadCharData(url).then((buf) => {
    glbLoader.parse(buf, '', onGLB, () => {});
  }).catch(() => { /* تبقى الصورة المسطحة */ });
  function onGLB(gl) {
    const model = gl.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const map = o.material.map;
      if (map) { map.encoding = THREE.LinearEncoding; map.anisotropy = renderer.capabilities.getMaxAnisotropy(); }   // وجه أوضح من قرب
      // ألوان الشخصية كما في صورتها تمامًا (البشرة والملابس)، دون أن تغيّرها إضاءة اللعبة؛ الظلال مرسومة أصلًا في خامة Meshy
      o.material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
    });
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(height / (box.max.y - box.min.y));
    if (group.userData.plane) group.userData.plane.visible = false;
    if (group.userData.body) group.userData.body.visible = false;
    // بلا قرص ظل تحت القدمين (الأستاذة منجية: يبدو كقاعدة دمية)
    group.children.forEach((c) => { if (c.geometry && c.geometry.type === 'CircleGeometry') c.visible = false; });
    group.add(model);
    addHands(model, url, height);
    const mixer = new THREE.AnimationMixer(model);
    const acts = {};
    for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
    group.userData.glb = { mixer, acts, cur: null };
    glbChars.push(group);
    setAnim(group, 'idle');
  }
}
// يدا شتشوتة ملتصقتان بفستانها في صورتها، فلوّنهما Meshy بلون الفستان: نضع يدين بلون بشرتها على مفصلَي اليدين
const HAND_FIX = { shtshouta: 0xf0c4a6 };
function addHands(model, url, height) {
  const key = url.split('/').pop().replace(/\.js$/, '');
  const col = HAND_FIX[key];
  if (!col) return;
  model.updateMatrixWorld(true);
  const s = new V3();
  model.traverse((b) => {
    if (!b.isBone || !/(Left|Right)Hand$/.test(b.name)) return;
    b.getWorldScale(s);
    const r = height * 0.04;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: col }));
    hand.scale.set(r / s.x, r * 1.35 / s.y, r * 0.75 / s.z);
    // اليد تخرج قليلًا خارج الفستان (إلى الجانب وإلى الأمام) حتى تُرى
    const wp = b.getWorldPosition(new V3()), mp = model.worldToLocal(wp.clone());
    const out = new V3(Math.sign(mp.x) * height * 0.06, -height * 0.02, height * 0.025);
    out.applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert());
    hand.position.set(out.x / s.x, out.y / s.y + r * 0.6 / s.y, out.z / s.z);
    b.add(hand);
  });
}
// idle | walk | run — الوقوف يستعمل Idle إن وُجدت، وإلا أول لقطة من المشي ساكنة
function setAnim(group, kind, speed = 1) {
  const g = group.userData.glb;
  if (!g) return;
  const a = g.acts;
  let name = kind === 'run' ? (a.Running ? 'Running' : 'Walking') : kind === 'walk' ? 'Walking' : (a.Idle ? 'Idle' : 'Walking');
  const still = kind === 'idle' && !a.Idle;
  const key = name + (still ? ':still' : '');
  if (key !== g.cur) {
    const prev = g.cur && a[g.cur.split(':')[0]];
    const next = a[name];
    if (prev && prev !== next) prev.fadeOut(0.25);
    if (prev !== next) next.reset().fadeIn(0.25).play();
    if (still) next.time = 0;
    g.cur = key;
  }
  a[name].timeScale = still ? 0 : speed;
}
function friendPlaceholder(color, n) {          // صديق بلا صورة مرجعية بعد: شكل مؤقت واضح
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 12), mat(color, { transparent: true, opacity: 0.85 }), 0, 0.62, 0, g);
  const head = sphere(0.3, 0xf5f0ff, 0, 1.38, 0, g);
  const q = label('؟', 0.38, { bg: null, color: '#5a33b8', size: 90, pad: 6 }, g);
  q.position.set(0, 1.38, 0.31);
  const tag = label(`صديق ${n} · صورة مؤقتة`, 0.28, { size: 44, border: '#999' }, g);
  tag.position.set(0, 2.05, 0);
  blob(g, 0.45);
  g.userData.body = body; g.userData.head = head; g.userData.tag = tag;
  scene.add(g);
  return g;
}
// البطل الذي يلعب به التلميذ: بنت أو ولد، بالزي المدرسي (قميص أصفر وصدرية كحلية)
function makePlayer(hero = 'boy') {
  const girl = hero === 'girl';
  const g = new THREE.Group();
  const skin = 0xe9b48a, navy = 0x1f3a7a, shirt = 0xf7e08a;
  const hipL = new THREE.Group(), hipR = new THREE.Group();
  hipL.position.set(0.13, 0.62, 0); hipR.position.set(-0.13, 0.62, 0);
  g.add(hipL, hipR);
  const leg = girl ? 0xffffff : navy;                           // جوارب بيضاء للبنت، بنطال كحلي للولد
  cyl(0.09, 0.08, 0.55, leg, 0, -0.28, 0, hipL); cyl(0.09, 0.08, 0.55, leg, 0, -0.28, 0, hipR);
  const shoe = girl ? 0x111111 : 0xffffff;
  box(0.16, 0.1, 0.26, shoe, 0, -0.56, 0.04, hipL); box(0.16, 0.1, 0.26, shoe, 0, -0.56, 0.04, hipR);
  const torso = mesh(new THREE.CapsuleGeometry(0.25, 0.32, 4, 12), navy, 0, 0.98, 0, g);
  box(0.3, 0.12, 0.05, shirt, 0, 0.3, 0.24, torso);                // ياقة القميص
  sphere(0.06, 0xffd23f, 0.12, 0.08, 0.25, torso, 10);              // شعار المدرسة
  if (girl) { const skirt = cyl(0.26, 0.42, 0.36, navy, 0, -0.2, 0, torso, 16); box(0.02, 0.02, 0.02, navy, 0, 0, 0, skirt); cyl(0.425, 0.425, 0.03, 0xffffff, 0, -0.36, 0, torso, 16); }
  const shL = new THREE.Group(), shR = new THREE.Group();
  shL.position.set(0.32, 1.18, 0); shR.position.set(-0.32, 1.18, 0);
  g.add(shL, shR);
  cyl(0.07, 0.06, 0.48, shirt, 0, -0.22, 0, shL); cyl(0.07, 0.06, 0.48, shirt, 0, -0.22, 0, shR);
  sphere(0.07, skin, 0, -0.48, 0, shL, 8); sphere(0.07, skin, 0, -0.48, 0, shR, 8);
  const head = new THREE.Group(); head.position.set(0, 1.56, 0); g.add(head);
  sphere(0.27, skin, 0, 0, 0, head);
  const hairC = 0x3b2314;
  const hair = sphere(0.29, hairC, 0, 0.06, -0.04, head); hair.scale.set(1.05, 0.88, 1);
  if (girl) {
    box(0.5, 0.42, 0.16, hairC, 0, -0.16, -0.16, head);            // شعر طويل خلف الرأس
    for (const s of [1, -1]) sphere(0.13, hairC, s * 0.27, -0.12, -0.02, head, 10);
    for (const s of [1, -1]) sphere(0.07, navy, s * 0.09, 0.3, 0.05, head, 8);   // فيونكة كحلية
  } else for (let k = 0; k < 7; k++) sphere(0.08, hairC, Math.cos(k) * 0.2, 0.2 + (k % 2) * 0.04, Math.sin(k) * 0.12 - 0.02, head, 8);   // شعر مجعّد
  sphere(0.035, 0x1a1a1a, 0.09, 0.0, 0.25, head, 8); sphere(0.035, 0x1a1a1a, -0.09, 0.0, 0.25, head, 8);
  const smile = mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12, PI), 0x8a3b2a, 0, -0.08, 0.255, head); smile.rotation.z = PI;
  // الجسم المرسوم مؤقت: يختفي حين يُحمَّل نموذج Meshy المتحرك للبطل
  const body = new THREE.Group();
  [...g.children].forEach((c) => body.add(c));
  g.add(body); g.userData.body = body;
  blob(g, 0.45);
  const marker = label(G.name || 'أنت', 0.22, { size: 46, border: girl ? '#e84d8a' : '#ff8a3d' }, g);
  marker.position.y = 2.05;
  scene.add(g);
  upgradeToGLB(g, C.models && C.models[girl ? 'heroGirl' : 'heroBoy'], 1.7);
  return { g, hipL, hipR, shL, shR, torso, head, marker, hero };
}
function setHero(hero) {
  G.hero = hero;
  if (player && player.hero === hero) return;
  const old = player;
  player = makePlayer(hero);
  if (old) { player.g.visible = old.g.visible; player.g.position.copy(old.g.position); player.g.rotation.copy(old.g.rotation); scene.remove(old.g); }
}
/* ---------------- أجسام الوحوش ---------------- */
// جسم عضوي متعرّج بدل الكرة الملساء
function lumpyGeo(R, seed = 1, flat = false) {
  const geo = flat ? new THREE.DodecahedronGeometry(R, 1) : new THREE.IcosahedronGeometry(R, 4);
  const p = geo.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.08 * Math.sin(v.x * 2.7 + seed) * Math.sin(v.y * 3.3 + seed * 2) * Math.cos(v.z * 2.9) + (flat ? (Math.sin(i * 12.9898 + seed) * 0.5) * 0.08 : 0);
    v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
// فرو: خصلات صغيرة مخروطية على سطح الجسم (رسمة واحدة)
function addFur(parent, R, cy, color, count = 240, len = 0.3, sy = 1) {
  const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.075, len, 5), mat(color), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), n = new V3();
  for (let k = 0; k < count; k++) {
    const y = 1 - (k + 0.5) / count * 1.7, rr = Math.sqrt(1 - y * y), a = k * 2.399963;
    n.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    if (n.z > 0.55 && n.y > -0.2 && n.y < 0.75) continue;      // الوجه بلا فرو
    q.setFromUnitVectors(up, n.clone().add(new V3(0, 0.25, 0)).normalize());
    m4.compose(new V3(n.x * R * 1.08, cy + n.y * R * sy * 1.02, n.z * R * 1.05), q, new V3(1, 1 + (k % 3) * 0.25, 1));
    im.setMatrixAt(k, m4);
  }
  parent.add(im);
  return im;
}
// مخالب بيضاء صغيرة
function claws(parent, x, y, z, dir = 1, size = 0.12) {
  for (const k of [-1, 0, 1]) {
    const c = mesh(new THREE.ConeGeometry(size * 0.35, size, 6), 0xfffbea, x + k * size * 0.7, y, z, parent);
    c.rotation.x = dir * PI / 2;
  }
}
// وحش كامل: جسم وفرو وعينان وفم بأسنان وذراعان بمخالب ورجلان وذيل (وقرون أو أشواك حسب النوع)
function creature(inner, d, skin, col) {
  const shade = new THREE.Color(col).multiplyScalar(0.62).getHex();
  const light = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.45).getHex();
  const kind = d.shape || 'blob';
  const R = kind === 'big' ? 1.55 : kind === 'tree' ? 1.15 : 1.2;
  const legH = 0.55, cy = legH + R * 0.92;
  const body = mesh(lumpyGeo(R, R * 3, kind === 'box'), kind === 'tree' ? mat(0x7a5230) : skin, 0, cy, 0, inner);
  if (kind === 'box') body.material = mat(col, { emissive: col, emissiveIntensity: 0.2, flatShading: true });
  body.scale.set(1.08, 0.95, 0.95);
  const belly = mesh(lumpyGeo(R * 0.7, 2), mat(kind === 'tree' ? 0xa8794a : light), 0, cy - R * 0.25, R * 0.42, inner);
  belly.scale.set(0.95, 0.9, 0.55);
  if (kind === 'blob' || kind === 'big') addFur(inner, R, cy, shade, kind === 'big' ? 320 : 240, 0.32, 0.95);
  if (kind === 'box') for (let k = 0; k < 6; k++) {          // أشواك حجرية على الظهر
    const sp = mesh(new THREE.ConeGeometry(0.22, 0.75 - Math.abs(k - 2.5) * 0.1, 5), mat(shade, { flatShading: true }), 0, cy + R * 0.95 - Math.abs(k - 2.5) * 0.18, -R * 0.15 - k * 0.22 + 0.5, inner);
    sp.rotation.x = -0.35 - k * 0.12;
  }
  if (kind === 'tree') {                                     // تاج من الأوراق فوق الرأس وأغصان
    for (const [x, y, z, rr] of [[0, cy + R * 1.05, -0.1, 1.05], [-0.9, cy + R * 0.8, -0.2, 0.75], [0.9, cy + R * 0.85, -0.15, 0.8], [0, cy + R * 1.6, -0.2, 0.7]]) mesh(lumpyGeo(rr, x + 4), skin, x, y, z, inner);
    for (let k = 0; k < 9; k++) { const lf = sphere(0.16, light, Math.cos(k) * 1.2, cy + R * 1.1 + Math.sin(k * 3) * 0.5, Math.sin(k) * 0.5 + 0.4, inner, 6); lf.scale.set(1, 0.4, 1); }
  }
  // رجلان قصيرتان بقدمين ومخالب
  for (const sx of [-1, 1]) {
    const lx = sx * R * 0.48;
    cyl(0.3, 0.34, legH + 0.2, kind === 'tree' ? 0x6b4423 : skin, lx, (legH + 0.2) / 2, 0, inner, 10);
    const foot = sphere(0.36, kind === 'tree' ? 0x5a3a1e : shade, lx, 0.14, 0.18, inner, 12); foot.scale.set(1.05, 0.5, 1.4);
    if (kind !== 'tree') claws(inner, lx, 0.12, 0.62, 1, 0.16);
  }
  // ذراعان: كتف ثم ساعد ثم يد بمخالب (تتحرك في التحديث)
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * R * 0.98, cy + R * 0.1, 0.1); inner.add(sh);
    const armC = kind === 'tree' ? 0x7a5230 : skin;
    cyl(0.17, 0.22, 0.85, armC, 0, -0.38, 0, sh, 10);
    const fore = new THREE.Group(); fore.position.set(0, -0.78, 0); sh.add(fore);
    cyl(0.14, 0.17, 0.7, armC, 0, -0.3, 0.05, fore, 10);
    sphere(0.22, kind === 'tree' ? 0x5a3a1e : shade, 0, -0.68, 0.08, fore, 10);
    if (kind === 'tree') for (const k of [-1, 0, 1]) { const tw = cyl(0.025, 0.05, 0.4, 0x5a3a1e, k * 0.1, -0.88, 0.1, fore, 5); tw.rotation.z = k * 0.4; }
    else for (const k of [-1, 0, 1]) { const c = mesh(new THREE.ConeGeometry(0.05, 0.2, 6), 0xfffbea, k * 0.1, -0.9, 0.12, fore); c.rotation.x = PI; }
    sh.rotation.z = sx * 0.55; fore.rotation.x = -0.6;
    arms.push({ sh, fore, sx });
  }
  // ذيل يتدلّى خلفه
  const tail = new THREE.Group(); tail.position.set(0, legH + 0.45, -R * 0.85); inner.add(tail);
  for (let k = 0; k < 6; k++) sphere(0.26 - k * 0.035, kind === 'tree' ? 0x6b4423 : skin, 0, -k * 0.05 + Math.sin(k * 0.8) * 0.12, -k * 0.24, tail, 8);
  if (kind !== 'tree') { const tip = mesh(new THREE.ConeGeometry(0.14, 0.35, 6), shade, 0, 0.05, -1.55, tail); tip.rotation.x = -PI / 2; }
  // قرون منحنية
  if (d.horns || kind === 'big') for (const sx of [-1, 1]) {
    let px = sx * R * 0.5, py = cy + R * 0.82, ang = sx * -0.35;
    for (let k = 0; k < 4; k++) {
      const h = cyl(0.17 - k * 0.04, 0.2 - k * 0.04, 0.32, 0xfff3d6, px, py, -0.05, inner, 8);
      h.rotation.z = ang;
      px += -Math.sin(ang) * 0.28; py += Math.cos(ang) * 0.28; ang += sx * -0.32;
    }
  }
  // آذان: كبيرة مدبّبة (الاستماع) أو صغيرة مدورة
  if (d.ears) for (const sx of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.4, 1.2, 10), skin, sx * R * 1.05, cy + R * 0.55, 0, inner); e.rotation.z = sx * -1.0; const ie = mesh(new THREE.ConeGeometry(0.24, 0.9, 10), mat(0xff9fb6), sx * R * 1.05 + sx * 0.02, cy + R * 0.55, 0.12, inner); ie.rotation.z = sx * -1.0; }
  else if (!d.horns && kind !== 'tree') for (const sx of [-1, 1]) sphere(0.25, shade, sx * R * 0.72, cy + R * 0.8, -0.05, inner, 10).scale.set(1, 1.2, 0.6);
  // العيون على سطح الوجه، مع حواجب
  const n = d.eyes || 2, eyes = [];
  const eyeY = cy + R * 0.3, er = n === 1 ? 0.42 : 0.3;
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? 0 : (k / (n - 1) - 0.5) * (n === 3 ? 1.15 : 0.8);
    const y = eyeY + (n === 3 && k === 1 ? 0.28 : 0);
    const z = Math.sqrt(Math.max(0.05, R * R - x * x - (y - cy) * (y - cy))) * 0.93;
    const e = sphere(er, 0xffffff, x, y, z, inner, 14);
    const iris = sphere(er * 0.55, light, 0, 0, er * 0.62, e, 10);
    sphere(er * 0.32, 0x14081f, 0, 0, er * 0.3, iris, 8);
    sphere(er * 0.12, 0xffffff, er * 0.15, er * 0.15, er * 0.55, iris, 6);
    if (d.sleepy) { const lid = sphere(er * 1.05, skin, 0, er * 0.25, 0.02, e, 12); lid.scale.set(1, 0.6, 1); }
    else { const brow = box(er * 1.6, 0.09, 0.1, shade, x, y + er + 0.12, z + 0.05, inner); brow.rotation.z = (x === 0 ? 0 : -Math.sign(x) * 0.3); }
    eyes.push(e);
  }
  // الفم: فتحة داكنة بأسنان وأنياب ولسان
  const my = cy - R * 0.22, mz = Math.sqrt(R * R - (my - cy) ** 2) * 0.95;
  let mouth = null;
  if (d.mouthless) {
    box(1.0, 0.16, 0.1, 0xffffff, 0, my, mz, inner).rotation.z = 0.08;
    for (const x of [-0.3, 0, 0.3]) box(0.04, 0.3, 0.12, 0x555555, x, my, mz + 0.02, inner);
  } else {
    mouth = sphere(0.5, 0x2a0b18, 0, my, mz - 0.12, inner, 16); mouth.scale.set(1.25, 0.55, 0.45);
    const tongue = sphere(0.26, 0xff6b8a, 0, my - 0.12, mz - 0.02, inner, 10); tongue.scale.set(1.2, 0.5, 0.8);
    for (let k = 0; k < 6; k++) {
      const x = (k - 2.5) * 0.17, big = k === 0 || k === 5;
      const t = mesh(new THREE.ConeGeometry(big ? 0.08 : 0.06, big ? 0.28 : 0.16, 6), 0xfffef5, x, my + 0.16 - (big ? 0.06 : 0), mz + 0.08 - Math.abs(x) * 0.15, inner);
      t.rotation.x = PI;
    }
    for (const x of [-0.25, 0.25]) { const t = mesh(new THREE.ConeGeometry(0.06, 0.15, 6), 0xfffef5, x, my - 0.17, mz + 0.06, inner); }
  }
  return { eyes, mouth, arms, tail, top: cy + R * (kind === 'big' || d.horns ? 2.0 : kind === 'tree' ? 2.4 : 1.15), front: mz };
}
function makeMonster() {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const col = 0x7b3fe4;
  const c = creature(inner, { shape: 'blob', eyes: 2, horns: true }, mat(col), col);
  const body = inner.children[0];
  // العيون تتبع اللاعب: نحتفظ بالحدقة لكل عين
  const eyes = c.eyes.map((e) => ({ e, p: e.children[0] }));
  inner.position.y = 0; inner.userData.scaleY = 1;
  // أجنحة على شكل غلاف كتاب
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.7, 2.2, -0.75); inner.add(pivot);
    const cover = box(1.3, 1.0, 0.08, 0xe84d8a, s * 0.65, 0, 0, pivot);
    box(1.2, 0.9, 0.1, 0xfffaf0, s * 0.6, 0, 0.06, pivot);
    pivot.rotation.y = s * 0.5;
    wings.push({ pivot, s, cover });
  }
  blob(g, 1.1);
  // حروف تدور حوله
  const letters = [];
  ['ق', 'ر', 'ء', 'ك', 'ت', 'ب'].forEach((ch, i) => {
    const l = label(ch, 0.45, { bg: null, color: '#ffe066', stroke: '#5a33b8', size: 90, pad: 8 }, g);
    letters.push({ l, a: i / 6 * PI * 2 });
  });
  const name = label(C.names.monster, 0.42, { size: 50, border: '#e84d8a' }, g);
  name.position.y = c.top + 0.5;
  scene.add(g);
  return { g, inner, eyes, wings, letters, name, body, arms: c.arms, tail: c.tail, state: 'idle', target: new V3(), seen: 0, lost: 0, wp: 0, hurt: 0, alive: true };
}
function makeShadowMonster(color) {           // وحوش صغيرة تطير من الكتاب في المشهد الافتتاحي
  const g = new THREE.Group();
  const b = sphere(0.45, color, 0, 0, 0, g, 14);
  b.material = mat(color, { emissive: color, emissiveIntensity: 0.35 });
  for (const s of [1, -1]) { const e = sphere(0.12, 0xffffff, s * 0.16, 0.1, 0.36, g, 8); sphere(0.06, 0x000000, 0, 0, 0.08, e, 6); }
  glow(color, 2.2, g);
  scene.add(g);
  return g;
}
const extraStars = [];
const allStars = () => yard.stars.concat(lib.stars, extraStars);
function addStar(id, x, y, z) {
  const st = starMesh(id); st.position.set(x, y, z);
  const o = { id, obj: st, y };
  st.visible = !G.stars.has(id);
  extraStars.push(o);
  return o;
}
/* ---------------- مهارات المادة ---------------- */
// كل شارة في اللعبة تنتمي إلى مهارة: في الساحة والمكتبة القراءة، وفي كل غرفة مهارتها، وفي الممر بالتناوب
const SKILLS = RX.skills || [];
const skillById = (id) => SKILLS.find((k) => k.id === id) || SKILLS[0];
const ROOM_SKILL = { class: 'expression', mongia: 'homework', secret: 'review' };
function skillFor(orbId) {
  if (/^[yl]/.test(orbId)) return 'reading';
  if (orbId[0] === 'h') return SKILLS[(+orbId.slice(1) + 1) % SKILLS.length].id;
  const room = SC.rooms[parseInt(orbId.slice(1), 10)];
  return ROOM_SKILL[room.id] || room.id;
}
const skillPoints = () => Object.values(G.skills).reduce((x, y) => x + y, 0);
const skillLevel = (id) => Math.min(5, Math.floor((G.skills[id] || 0) / 2));
function gainSkill(id, n = 1, msg = RX.skillGain) {
  const k = skillById(id);
  if (!k) return;
  const before = powerLevel();
  G.skills[k.id] = (G.skills[k.id] || 0) + n;
  save();
  renderSkills();
  if (powerLevel() > before) levelUp();
  else toast(msg.replace('{icon}', k.icon).replace('{name}', k.name), 'good', 2000);
}
function starMesh(orbId) {
  const k = skillById(skillFor(orbId || 'y'));
  const col = new THREE.Color(k.color).getHex();
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), mat(col, { emissive: col, emissiveIntensity: 0.4 }), 0, 0, 0, g).rotation.x = PI / 2;
  mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), mat(0xffd23f, { emissive: 0xffa500, emissiveIntensity: 0.5 }), 0, 0, 0, g);
  const ic = label(k.icon, 0.55, { bg: null, size: 100, pad: 4 }, g); ic.position.z = 0.08;
  glow(col, 1.8, g);
  g.userData.skill = k.id;
  scene.add(g);
  return g;
}

/* ---------------- الساحة والبوابة (على تصميم الأستاذة منجية) ---------------- */
const yard = { doors: [], stars: [], friends: [], table: null, book: null, bookLid: null, clouds: [] };
const SC = C.school;
// مواضع تطير إليها الوحوش في المشهد الافتتاحي: نوافذ الواجهة
function doorPos(i) { return new V3([0, -12, 12, -20, 20, 0][i], i === 5 ? 9 : 5.5, -23.6); }

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// رخام ببلاطات فاتحة ومعيّنات زرقاء
const marbleTex = (rx, ry) => canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#f2e6d4'; g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(160,140,120,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, w);
  g.fillStyle = '#9fb3d1';
  g.beginPath(); g.moveTo(w / 2, w * 0.3); g.lineTo(w * 0.7, w / 2); g.lineTo(w / 2, w * 0.7); g.lineTo(w * 0.3, w / 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(10, 10, w * 0.4, 6);
}, [rx, ry]);

function palm(x, z, h = 7) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const trunk = cyl(0.25, 0.4, h, 0x9a7247, 0, h / 2, 0, g, 8); trunk.rotation.z = 0.06;
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.5, 3.6, 4), mat(i % 2 ? 0x3f8f3a : 0x4caf50), 0, 0, 0, g);
    const a = i / 7 * PI * 2;
    leaf.position.set(Math.cos(a) * 1.4, h - 0.3, Math.sin(a) * 1.4);
    leaf.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
    leaf.scale.set(1, 1, 0.25);
  }
  addCol(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
}
function lantern(x, z, h = 3.2, parent = scene) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  cyl(0.08, 0.12, h, 0x2b2b33, 0, h / 2, 0, g, 8);
  box(0.5, 0.65, 0.5, mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 0.9 }), 0, h + 0.3, 0, g);
  box(0.62, 0.08, 0.62, 0x2b2b33, 0, h + 0.68, 0, g);
  glow(0xffc46b, 2.6, g).position.y = h + 0.3;
  return g;
}

function buildYard() {
  // أرضية الرخام
  const plaza = mesh(new THREE.PlaneGeometry(70, 56), new THREE.MeshLambertMaterial({ map: marbleTex(18, 14) }), 0, 0, 3);
  plaza.rotation.x = -PI / 2;
  const grass = mesh(new THREE.PlaneGeometry(160, 160), 0x6fae55, 0, -0.02, 0); grass.rotation.x = -PI / 2;
  // أحواض زرع وزهور على الجانبين
  for (const s of [-1, 1]) {
    box(6, 0.5, 40, 0xe9dcc6, s * 30, 0.25, 6);
    const bed = box(5.4, 0.12, 39.4, 0x5c8f3a, s * 30, 0.52, 6);
    for (let k = 0; k < 26; k++) sphere(0.28, [0xff6b8a, 0xffffff, 0xc77dff, 0xffd23f][k % 4], s * (28 + (k * 37 % 5)), 0.75, -12 + k * 1.45, scene, 6);
    addCol(s * 30 - 3, s * 30 + 3, -14, 26);
  }

  // الواجهة: مبنى بلون الحجر الفاتح، ونوافذ مضيئة دافئة
  const stone = 0xf1e2c4;
  solid(66, 13, 10, stone, 0, 6.5, -29);
  box(67, 0.6, 11, 0xd9c29a, 0, 13.2, -29);
  box(22, 17, 6, stone, 0, 8.5, -26.5);                       // الكتلة الوسطى البارزة
  box(23, 1, 7, 0xd9c29a, 0, 17.2, -26.5);
  const glass = mat(0xffe2a6, { emissive: 0xffc56b, emissiveIntensity: 0.55 });
  for (const [x, y, w, hgt] of [[-6, 9.5, 3.2, 5], [0, 9.5, 4.2, 5], [6, 9.5, 3.2, 5], [-6, 3.6, 3, 4.6], [6, 3.6, 3, 4.6]]) {
    box(w, hgt, 0.2, glass, x, y, -23.4);
    box(w + 0.4, 0.3, 0.5, 0xffffff, x, y - hgt / 2 - 0.15, -23.3);
  }
  for (const x of [-10.5, -3, 3, 10.5]) cyl(0.45, 0.5, 12, 0xfaf3e6, x, 6, -23.1, scene, 14);
  // نوافذ جانبية بطابقين
  for (let x = -31; x <= 31; x += 4.5) {
    if (Math.abs(x) < 12) continue;
    for (const y of [3.5, 8.8]) box(2.2, 3, 0.2, glass, x, y, -23.9);
  }
  // اللافتة الكبرى
  box(17, 3.4, 0.5, 0x1d2a5c, 0, 14.6, -23.4);
  box(17.6, 4, 0.3, 0xd4a64a, 0, 14.6, -23.6);
  signPlane(SC.sign, 13, { size: 120, color: '#f6d27a', weight: 900 }).position.set(0, 14.9, -23.1);
  const sub = signPlane(SC.subtitle, 11, { size: 56, color: '#1d2a5c', bg: '#fbf3dc', border: '#d4a64a', maxW: 1400 });
  sub.position.set(0, 12.1, -23.1);
  // كتاب ذهبي فوق اللافتة
  const topBook = new THREE.Group(); topBook.position.set(0, 17.6, -23.3); scene.add(topBook);
  for (const s of [-1, 1]) { const p = box(1.3, 0.12, 1.8, mat(0xf3d27a, { emissive: 0xb8860b, emissiveIntensity: 0.3 }), s * 0.62, 0, 0, topBook); p.rotation.z = s * -0.35; }
  topBook.rotation.x = PI / 2.4;
  // رايات عمودية بعبارات المدرسة
  const bannerColors = ['#2c4d9a', '#8e2d7a', '#1f6fa8', '#7a2d8e'];
  [[-17, 9], [17, 9], [-26, 7.5], [26, 7.5]].forEach(([x, y], i) => {
    box(2.6, 7.4, 0.15, new THREE.Color(bannerColors[i]).getHex(), x, y, -23.75);
    const t = signPlane(SC.banners[i], 2.3, { size: 60, color: '#fff', maxW: 300, pad: 14 });
    t.position.set(x, y + 0.6, -23.6);
    sphere(0.22, 0xf6d27a, x, y - 3, -23.6, scene, 8);
  });

  // الباب الرئيسي (بنفسجي) ويؤدي إلى الممر
  const entrance = new THREE.Group(); entrance.position.set(0, 0, -23.2); scene.add(entrance);
  box(5.2, 6.4, 0.6, 0xd4a64a, 0, 3.2, 0, entrance);
  const leaf = box(4.2, 5.6, 0.3, mat(0x8e5cf7, { emissive: 0x3d1a80, emissiveIntensity: 0.25 }), 0, 2.8, 0.25, entrance);
  box(0.12, 4.6, 0.1, 0xf6d27a, 0, 2.8, 0.42, entrance);
  const glowSp = glow(0xb388ff, 8, entrance); glowSp.position.set(0, 2.8, 1);
  const arrow = label('⬇', 0.9, { bg: null, color: '#ffd23f', stroke: '#5a33b8', size: 100, pad: 6 }, entrance);
  arrow.position.set(0, 7.2, 0.8); arrow.visible = false;
  yard.doors.push({ grp: entrance, leaf, arrow, glow: glowSp, pos: new V3(0, 0, -24) });
  // «باب» ثانٍ رمزي للمشهد الختامي: نافذة الطابق العلوي التي تهرب منها الحروف
  const win = new THREE.Group(); win.position.set(12, 5.5, -23.3); scene.add(win);
  yard.doors.push({ grp: win, leaf: null, arrow: null, glow: null, pos: new V3(12, 0, -24) });

  // البوابة الأمامية المفتوحة مع الأعمدة والفوانيس والسور
  for (const s of [-1, 1]) {
    solid(2.6, 5.4, 2.6, 0xf3e6cf, s * 6.5, 2.7, 27);
    box(3, 0.4, 3, 0xd9c29a, s * 6.5, 5.6, 27);
    lantern(s * 6.5, 27, 5.8);
    const gate = new THREE.Group(); gate.position.set(s * 5.2, 0, 27.6); scene.add(gate);
    for (let k = 0; k < 9; k++) box(0.08, 4.4, 0.08, 0x1d1d24, -s * (0.25 + k * 0.42), 2.3, 0, gate);
    box(4, 0.15, 0.12, 0xd4a64a, -s * 1.95, 4.4, 0, gate); box(4, 0.15, 0.12, 0xd4a64a, -s * 1.95, 0.6, 0, gate);
    gate.rotation.y = s * 1.1;
    const flag = signPlane('مدرسة\nالصداقة', 1.8, { size: 54, color: '#1d2a5c', bg: '#fbf6ea', border: '#d4a64a', maxW: 300 });
    flag.position.set(s * 6.5, 3.2, 28.35);
    // سور منخفض
    box(26, 1.2, 0.6, 0xf3e6cf, s * 21, 0.6, 28.5);
    for (let k = 0; k < 13; k++) box(0.08, 1.4, 0.08, 0x1d1d24, s * (9 + k * 2), 1.9, 28.5);
    addCol(s * 34, s * 8, 28, 29.2);
  }
  // ترتيب طرفي الحدّين بشكل صحيح
  colliders.slice(-2).forEach((c) => { const a = Math.min(c.minX, c.maxX), b = Math.max(c.minX, c.maxX); c.minX = a; c.maxX = b; });
  const gateSign = signPlane(SC.gate, 7, { size: 58, color: '#f6d27a', bg: '#1d2a5c', border: '#d4a64a', maxW: 1200 });
  gateSign.position.set(0, 6.2, 28.3); gateSign.rotation.y = PI;
  box(13, 0.5, 0.5, 0x1d1d24, 0, 5.7, 27.6);
  addCol(-36, 36, 29.2, 31); addCol(33, 36, -24, 31); addCol(-36, -33, -24, 31);

  // نخيل وفوانيس على جانبي الممشى
  [[-15, 22], [15, 22], [-15, 6], [15, 6], [-15, -10], [15, -10], [-24, -18], [24, -18]].forEach(([x, z], i) => palm(x, z, 6.5 + (i % 3) * 0.6));
  [[-9, 16], [9, 16], [-9, 0], [9, 0], [-9, -16], [9, -16]].forEach(([x, z]) => { lantern(x, z); addCol(x - 0.2, x + 0.2, z - 0.2, z + 0.2); });

  // نافورة الكتاب المفتوح
  const fx = 0, fz = 12;
  cyl(4.2, 4.5, 0.8, 0xe9dcc6, fx, 0.4, fz, scene, 32);
  const water = mesh(new THREE.CircleGeometry(3.9, 32), new THREE.MeshBasicMaterial({ color: 0x5ec8f0, transparent: true, opacity: 0.85 }), fx, 0.82, fz);
  water.rotation.x = -PI / 2;
  cyl(1, 1.3, 1.6, 0xe9dcc6, fx, 1.2, fz, scene, 20);
  const fBook = new THREE.Group(); fBook.position.set(fx, 2.3, fz); scene.add(fBook);
  for (const s of [-1, 1]) {
    const pg = box(1.6, 0.12, 2.2, 0xfffaf0, s * 0.78, 0, 0, fBook); pg.rotation.z = s * -0.28;
    box(1.66, 0.06, 2.28, 0x8c5a2b, s * 0.78, -0.08, 0, fBook).rotation.z = s * -0.28;
  }
  fBook.rotation.x = -0.35;
  glow(0x9ad7ff, 6, scene).position.set(fx, 2.5, fz);
  yard.water = water;
  addCol(fx - 4.4, fx + 4.4, fz - 4.4, fz + 4.4);
  // مقاعد
  [[-9, 8], [9, 8], [-9, -6], [9, -6]].forEach(([x, z]) => {
    box(0.8, 0.15, 2.6, 0xb5793f, x, 0.6, z); box(0.7, 0.6, 0.15, 0x6b4a2b, x, 0.3, z - 1.1); box(0.7, 0.6, 0.15, 0x6b4a2b, x, 0.3, z + 1.1);
    addCol(x - 0.4, x + 0.4, z - 1.3, z + 1.3);
  });
  // أصص نباتات قرب الواجهة
  [[-4.5, -21.5], [4.5, -21.5], [-13, -21.5], [13, -21.5]].forEach(([x, z]) => {
    cyl(0.7, 0.5, 1, 0xfaf3e6, x, 0.5, z, scene, 14);
    sphere(0.9, 0x4f9a45, x, 1.6, z, scene, 10);
    addCol(x - 0.7, x + 0.7, z - 0.7, z + 0.7);
  });
  // طاولة الكتاب السحري
  yard.table = new THREE.Group(); yard.table.position.set(0, 0, 1); scene.add(yard.table);
  box(2.4, 0.15, 1.4, 0xc97b3c, 0, 0.85, 0, yard.table);
  for (const [x, z] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) box(0.12, 0.85, 0.12, 0x8b5a2b, x, 0.42, z, yard.table);
  addCol(-1.25, 1.25, 0.3, 1.7);
  yard.book = new THREE.Group(); yard.book.position.set(0, 1.0, 0); yard.table.add(yard.book);
  box(0.9, 0.12, 0.65, 0xfffaf0, 0, 0, 0, yard.book);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0.47, 0.08, 0); yard.book.add(lidPivot);
  box(0.96, 0.05, 0.7, 0x5a33b8, -0.48, 0, 0, lidPivot);
  box(0.96, 0.05, 0.7, 0x5a33b8, 0, -0.08, 0, yard.book);
  yard.bookLid = lidPivot;
  yard.bookGlow = glow(0xb388ff, 2.4, yard.book);
  // سحب
  for (let i = 0; i < 7; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) sphere(2 + Math.random() * 1.5, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }), k * 2.2, Math.random(), Math.random(), cl, 10);
    cl.position.set(-60 + i * 20, 24 + Math.random() * 8, -60 + Math.random() * 30);
    scene.add(cl); yard.clouds.push(cl);
  }
  // نجوم الساحة
  [[-14, 8], [14, 8], [-22, -12], [22, -10], [-6, 20], [8, 22], [26, 14], [-26, 16]].forEach(([x, z], i) => {
    const s = starMesh('y' + i); s.position.set(x, 1.1, z);
    yard.stars.push({ id: 'y' + i, obj: s });
  });
}

/* ---------------- المكتبة المسحورة ---------------- */
const lib = { pages: [], tiles: [], bridge: [], books: [], stars: [], gapCol: null, sideCols: [], cage: null, bars: [], door: null, doorText: null, board: null, lectern: null, hides: [], entryCol: null, exitGlow: null };
const GAP_N = -7, GAP_S = -12.5;              // حافتا الهاوية على المحور z
// أرضية خشبية بألواح وعروق
const woodTex = (rx, ry, base = '#b9824f') => canvasTex(256, 256, (g, w) => {
  g.fillStyle = base; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 4; i++) {
    const y = i * 64;
    g.fillStyle = i % 2 ? 'rgba(255,230,200,.10)' : 'rgba(60,30,10,.10)'; g.fillRect(0, y, w, 64);
    g.strokeStyle = 'rgba(90,50,20,.2)'; g.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const yy = y + 4 + ((k * 37 + i * 11) % 56); g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 3, w * 0.6, yy - 3, w, yy + 1); g.stroke(); }
    g.fillStyle = 'rgba(50,25,10,.55)'; g.fillRect(0, y, w, 2); g.fillRect((i * 97 + 30) % w, y, 2, 64);
  }
}, [rx, ry]);
// كعب كتاب أبيض يُلوَّن بلون كل كتاب: شريطان داكنان وأسطر العنوان
let spineTex = null;
const libBooks = [];
function addBook(x, y, z, sx, sy, sz, c, ry = 0, rz = 0) { libBooks.push({ x, y, z, sx, sy, sz, c, ry, rz }); }
function flushBooks() {                           // كل كتب المكتبة في رسمة واحدة (سريعة على أجهزة المدرسة)
  spineTex = spineTex || canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 16, w, 12); g.fillRect(0, h - 30, w, 12);
    g.fillStyle = 'rgba(255,245,200,.95)'; for (let k = 0; k < 3; k++) g.fillRect(16, 80 + k * 26, w - 32, 7);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
  });
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: spineTex }), libBooks.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  libBooks.forEach((b, i) => {
    m4.compose(new V3(b.x, b.y, b.z), q.setFromEuler(e.set(0, b.ry, b.rz)), new V3(b.sx, b.sy, b.sz));
    im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(b.c));
  });
  scene.add(im);
  libBooks.length = 0;
}
const BOOK_COLORS = [0x8e2a2a, 0x1f4e79, 0x2e6b3a, 0xc8962e, 0x5a2d82, 0xb5462f, 0x2a7f86, 0x7a4a1e, 0xd9c7a0, 0x3a3a5c, 0xa23c6a, 0x4f7f2a];
// رفّ كتب خشبي: ألواح وجوانب، وكتب بأطوال وألوان مختلفة، بعضها مائل وبعضها مكدّس
// faces: الوجوه التي عليها كتب (1 و/أو -1 على المحور العمودي على طول الرف)
function bookcase(x, z, w, d, faces = [1, -1], h = 3.2) {
  const core = solid(w, h, d, 0x5a3318, x, h / 2, z);
  const long = w >= d, len = long ? w : d, half = (long ? d : w) / 2;
  const at = (a, out, side) => long ? [x + a, z + side * (half + out)] : [x + side * (half + out), z + a];
  const wood = 0x7a4a26, rows = [0.12, 0.92, 1.72, 2.52];
  let seed = Math.abs(Math.round(x * 7 + z * 13));
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const side of faces) {
    for (const y of rows.concat([h - 0.04])) {        // الألواح الأفقية
      const [bx, bz] = at(0, 0.15, side);
      box(long ? len + 0.08 : 0.3, 0.07, long ? 0.3 : len + 0.08, wood, bx, y, bz);
    }
    for (const a of [-len / 2, len / 2]) { const [bx, bz] = at(a, 0.15, side); box(long ? 0.09 : 0.3, h, long ? 0.3 : 0.09, wood, bx, h / 2, bz); }
    rows.forEach((y) => {                           // صفّ كتب فوق كل لوح
      let a = -len / 2 + 0.1;
      while (a < len / 2 - 0.12) {
        const t = rnd();
        if (t < 0.06) { a += 0.25; continue; }        // فراغ صغير
        if (t < 0.13 && a < len / 2 - 0.5) {          // كتب مكدّسة على جنبها
          for (let k = 0; k < 3; k++) {
            const [bx, bz] = at(a + 0.2, 0.14, side);
            addBook(bx, y + 0.06 + k * 0.07 + 0.03, bz, long ? 0.42 - k * 0.04 : 0.24, 0.06, long ? 0.24 : 0.42 - k * 0.04, BOOK_COLORS[(rnd() * 12) | 0]);
          }
          a += 0.5; continue;
        }
        const th = 0.07 + rnd() * 0.08, bh = 0.46 + rnd() * 0.22;
        const lean = t > 0.95 ? (side * (long ? 1 : -1)) * 0.25 : 0;
        const [bx, bz] = at(a + th / 2, 0.14, side);
        addBook(bx, y + 0.035 + bh / 2, bz, long ? th : 0.23, bh, long ? 0.23 : th, BOOK_COLORS[(rnd() * 12) | 0], 0, long ? lean : 0);
        a += th + 0.006 + (lean ? 0.12 : 0);
      }
    });
  }
  return core;
}
// طاولة قراءة عليها كتاب مفتوح وأوراق، وكرسيّان
function readingTable(x, z) {
  const wood = 0x8a5a33;
  box(2.2, 0.08, 1.1, wood, x, 0.8, z);
  for (const [dx, dz] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) box(0.08, 0.8, 0.08, 0x6b3e1f, x + dx, 0.4, z + dz);
  addCol(x - 1.1, x + 1.1, z - 0.55, z + 0.55);
  for (const s of [-1, 1]) {                         // صفحتا الكتاب المفتوح
    const pg = box(0.34, 0.02, 0.46, 0xfffaf0, x - 0.4 + s * 0.17, 0.86, z); pg.rotation.z = -s * 0.12;
  }
  box(0.7, 0.02, 0.48, 0x8e2a2a, x - 0.4, 0.845, z);
  for (let k = 0; k < 3; k++) { const p = box(0.3, 0.005, 0.4, 0xfdfbf3, x + 0.5 + k * 0.05, 0.846 + k * 0.004, z + k * 0.04); p.rotation.y = k * 0.3 - 0.2; }
  for (let k = 0; k < 4; k++) addBook(x + 0.85, 0.87 + k * 0.07, z - 0.25, 0.32, 0.06, 0.24, BOOK_COLORS[(k * 5 + 2) % 12], k * 0.15);
  for (const s of [-1, 1]) {
    const cz = z + s * 0.95;
    box(0.5, 0.06, 0.5, 0x7a4a26, x, 0.48, cz);
    box(0.5, 0.6, 0.06, 0x7a4a26, x, 0.8, cz + s * 0.24);
    for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) box(0.05, 0.48, 0.05, 0x5a3318, x + dx, 0.24, cz + dz);
  }
}
// أوراق مبعثرة على الأرض
function scatterPapers(x0, x1, z0, z1, n) {
  for (let k = 0; k < n; k++) {
    const p = mesh(new THREE.PlaneGeometry(0.32, 0.42), new THREE.MeshLambertMaterial({ color: k % 5 ? 0xfdfbf3 : 0xf3e7c9, side: THREE.DoubleSide }), x0 + Math.random() * (x1 - x0), 0.015 + k * 0.0004, z0 + Math.random() * (z1 - z0));
    p.rotation.x = -PI / 2; p.rotation.z = Math.random() * PI * 2;
  }
}
function buildLibrary() {
  const floorA = mesh(new THREE.PlaneGeometry(28, 19), new THREE.MeshLambertMaterial({ map: woodTex(7, 5) }), LX, 0, 2.5); floorA.rotation.x = -PI / 2;
  const floorB = mesh(new THREE.PlaneGeometry(28, 19.5), new THREE.MeshLambertMaterial({ map: woodTex(7, 5, '#8f5f3a') }), LX, 0, -22.25); floorB.rotation.x = -PI / 2;
  const rug = mesh(new THREE.CircleGeometry(5, 32), 0x6a3fbf, LX, 0.02, -22); rug.rotation.x = -PI / 2;
  const rugA = mesh(new THREE.PlaneGeometry(7, 4.5), 0x8e2a2a, LX, 0.012, 7.5); rugA.rotation.x = -PI / 2;
  const rugIn = mesh(new THREE.PlaneGeometry(6.4, 3.9), 0xc8962e, LX, 0.014, 7.5); rugIn.rotation.x = -PI / 2;
  const rugC = mesh(new THREE.PlaneGeometry(6, 3.4), 0x8e2a2a, LX, 0.016, 7.5); rugC.rotation.x = -PI / 2;
  // الهاوية
  const pit = mesh(new THREE.PlaneGeometry(28, 6), new THREE.MeshBasicMaterial({ color: 0x120a30 }), LX, -6, (GAP_N + GAP_S) / 2); pit.rotation.x = -PI / 2;
  for (const z of [GAP_N, GAP_S]) box(28, 0.25, 0.25, mat(0xb388ff, { emissive: 0x8e5cf7, emissiveIntensity: 0.8 }), LX, -0.1, z);
  box(28, 6, 0.1, 0x2a1460, LX, -3, GAP_N - 0.05); box(28, 6, 0.1, 0x2a1460, LX, -3, GAP_S + 0.05);
  for (let i = 0; i < 26; i++) { const sp = glow(0xb388ff, 0.5 + Math.random(), scene); sp.position.set(LX - 13 + Math.random() * 26, -1 - Math.random() * 4, GAP_S + Math.random() * 5.5); }
  lib.gapCol = addCol(LX - 14, LX + 14, GAP_S, GAP_N);
  lib.gapCol.sight = false;
  lib.sideCols = [addCol(LX - 14, LX - 1.6, GAP_S, GAP_N), addCol(LX + 1.6, LX + 14, GAP_S, GAP_N)];
  lib.sideCols.forEach((c) => { c.on = false; c.sight = false; });
  // الجدران
  const wallC = 0xe6d2ad;
  // إطار خشبي أسفل الجدران
  box(28, 0.6, 0.1, 0x6b3e1f, LX, 0.3, 11.95); box(28, 0.6, 0.1, 0x6b3e1f, LX, 0.3, -31.95);
  solid(30, 8, 1, wallC, LX, 4, 12.5);
  solid(1, 8, 46, wallC, LX - 14.5, 4, -10);
  solid(1, 8, 46, wallC, LX + 14.5, 4, -10);
  solid(30, 8, 1, wallC, LX, 4, -32.5);
  for (let z = 10; z > -31; z -= 6) for (const s of [-1, 1]) {
    const t = cyl(0.12, 0.12, 0.5, 0xfff3d6, LX + s * 13.9, 4.2, z);
    const fl = glow(0xffc93c, 1.4, scene); fl.position.set(LX + s * 13.9, 4.6, z);
  }
  const lightA = new THREE.PointLight(0xffd8a8, 0.8, 30); lightA.position.set(LX, 7, 2); scene.add(lightA);
  const lightB = new THREE.PointLight(0xc9a8ff, 0.9, 30); lightB.position.set(LX, 7, -22); scene.add(lightB);
  // باب الدخول (يُغلق خلف الفريق)
  box(4.4, 5, 0.3, 0x2a1460, LX, 2.5, 11.9);
  // رفوف الكتب: عوائق يمكن الاختباء خلفها
  bookcase(LX - 8.5, 6, 5, 1); bookcase(LX + 8.5, 6, 5, 1);
  bookcase(LX - 4.5, 0.5, 1, 4.5); bookcase(LX + 4.5, 0.5, 1, 4.5);
  bookcase(LX - 10, -2.5, 4, 1); bookcase(LX + 10.5, 1.5, 3, 1);
  // مكتبات على الجدران (كتب من الأرض حتى ارتفاع الرفوف)
  for (const [z0, z1] of [[-6.4, -1.5], [-0.5, 7.6]]) {
    bookcase(LX - 13.75, (z0 + z1) / 2, 0.5, z1 - z0, [1]);
    bookcase(LX + 13.75, (z0 + z1) / 2, 0.5, z1 - z0, [-1]);
  }
  bookcase(LX - 13.75, -21.5, 0.5, 16, [1]); bookcase(LX + 13.75, -18, 0.5, 9, [-1]);
  bookcase(LX - 8.3, -31.75, 9.5, 0.5, [1]); bookcase(LX + 8.3, -31.75, 9.5, 0.5, [1]);
  bookcase(LX - 8.3, 11.75, 9.5, 0.5, [-1]); bookcase(LX + 8.3, 11.75, 9.5, 0.5, [-1]);
  // طاولات القراءة والأوراق المبعثرة
  readingTable(LX - 6.8, 9.6); readingTable(LX + 6.8, 9.3);
  scatterPapers(LX - 12, LX + 12, -6, 11, 26);
  scatterPapers(LX - 12, LX + 12, -31, -13, 22);
  flushBooks();
  // ركنا الاختباء
  [[LX - 11.8, 9.5], [LX + 11.5, -4.6]].forEach(([x, z]) => {
    const r = mesh(new THREE.CircleGeometry(1.7, 28), mat(0x2bb673, { emissive: 0x1a7a46, emissiveIntensity: 0.6 }), x, 0.025, z); r.rotation.x = -PI / 2;
    const tent = mesh(new THREE.ConeGeometry(1.5, 2.3, 4, 1, true), mat(0x7cdba0, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), x, 1.15, z);
    tent.rotation.y = PI / 4;
    label('ركن القراءة\nمخبأ آمن', 0.6, { size: 46, border: '#2bb673' }).position.set(x, 3, z);
    lib.hides.push(new V3(x, 0, z));
  });
  // منصة القراءة
  lib.lectern = new THREE.Group(); lib.lectern.position.set(LX, 0, 3.2); scene.add(lib.lectern);
  cyl(0.25, 0.4, 1.1, 0x8b5a2b, 0, 0.55, 0, lib.lectern);
  const top = box(1.2, 0.08, 0.8, 0x6b3e1f, 0, 1.15, 0, lib.lectern); top.rotation.x = -0.4;
  lib.lecternGlow = glow(0xffe066, 3, lib.lectern); lib.lecternGlow.position.y = 1.3; lib.lecternGlow.visible = false;
  label('منصة القراءة', 0.45, { size: 46 }, lib.lectern).position.y = 2.1;
  addCol(LX - 0.5, LX + 0.5, 2.8, 3.6);
  // صفحات القصة المبعثرة
  [[LX - 12.3, 2], [LX + 12, 8.5], [LX - 7, -5.5], [LX + 7, -5.5], [LX + 2, 9.6]].forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 1, z); scene.add(g);
    const pg = mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ color: 0xfffaf0, side: THREE.DoubleSide }), 0, 0, 0, g);
    for (let k = 0; k < 4; k++) box(0.5, 0.04, 0.01, 0x8e8aa8, 0, 0.25 - k * 0.15, 0.01, g);
    glow(0xffe066, 2, g);
    lib.pages.push({ obj: g, taken: false });
  });
  // بلاطات الكلمات (جسر الكلمات)
  [6, 2, -2, -6].forEach((dx, i) => {
    const t = box(3.2, 0.12, 2.6, 0xd6c9ff, LX + dx, 0.06, -4.6);
    const lb = label(' ', 0.85, { size: 80, border: '#5a33b8', minW: 220 });
    lb.position.set(LX + dx, 2.0, -4.6); lb.visible = false;
    lib.tiles.push({ x: LX + dx, z: -4.6, mesh: t, lb, word: '' });
  });
  // أجزاء الجسر
  for (let k = 0; k < 4; k++) {
    const len = (GAP_N - GAP_S) / 4;
    const seg = box(3.2, 0.2, len - 0.05, mat(0xffe066, { emissive: 0xffa500, emissiveIntensity: 0.5 }), LX, -0.1, GAP_N - len * (k + 0.5));
    seg.visible = false;
    lib.bridge.push(seg);
  }
  // لوحة الألغاز فوق الهاوية
  lib.board = label(' ', 0.95, { size: 70, border: '#ffc93c', maxW: 1200 });
  lib.board.position.set(LX, 3.4, -14.5); lib.board.visible = false;
  // القفص والصديق
  lib.cage = new THREE.Group(); lib.cage.position.set(LX + 9, 0, -27); scene.add(lib.cage);
  cyl(1.5, 1.5, 0.2, 0x3b2a6b, 0, 0.1, 0, lib.cage, 20);
  cyl(1.5, 1.5, 0.2, 0x3b2a6b, 0, 3.1, 0, lib.cage, 20);
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * PI * 2;
    const b = cyl(0.06, 0.06, 3, 0x9a8acb, Math.cos(a) * 1.45, 1.6, Math.sin(a) * 1.45, lib.cage, 6);
    lib.bars.push(b);
  }
  addCol(LX + 7.5, LX + 10.5, -28.5, -25.5);
  // باب النجاة وجملته
  lib.door = new THREE.Group(); lib.door.position.set(LX, 0, -31.9); scene.add(lib.door);
  box(5.6, 6.4, 0.4, 0xffc93c, 0, 3.2, 0, lib.door);
  lib.doorLeaf = box(4.6, 5.6, 0.3, 0x3d1a80, 0, 2.8, 0.2, lib.door);
  lib.exitGlow = glow(0xfff2a8, 9, lib.door); lib.exitGlow.position.set(0, 2.8, 0.6); lib.exitGlow.visible = false;
  // كتب الكلمات الطائرة
  const spots = [[-10, -16], [-5, -19], [0, -16.5], [5, -19], [10, -16], [-9, -23], [-3.5, -26], [4, -24]];
  const words = C.spell.words.map((w, i) => ({ w, idx: i })).concat(C.spell.decoys.map((w) => ({ w, idx: -1 })));
  shuffle(words);
  words.forEach((wd, i) => {
    const g = new THREE.Group(); g.position.set(LX + spots[i][0], 2.45, spots[i][1]); scene.add(g);
    const color = [0xe84d8a, 0x2bb673, 0x5b6bd6, 0xff7a59, 0xffc93c][i % 5];
    box(0.9, 0.18, 0.7, color, 0, 0, 0, g); box(0.84, 0.14, 0.66, 0xfffaf0, 0.02, 0, 0, g);
    glow(0xffffff, 1.6, g);
    const lb = label(wd.w, 0.6, { size: 70, border: '#5a33b8' }, g); lb.position.y = 0.75;
    g.visible = false;
    lib.books.push({ obj: g, word: wd.w, idx: wd.idx, base: g.position.clone(), done: false, cool: 0 });
  });
  // نجوم المكتبة
  [[LX - 12.5, -5.5], [LX + 12.5, 10.5], [LX - 11, -29]].forEach(([x, z], i) => {
    const s = starMesh('l' + i); s.position.set(x, 1.1, z);
    lib.stars.push({ id: 'l' + i, obj: s });
  });
}
function drawDoorText(n) {
  const words = C.spell.words;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#3d1a80'; g.fillRect(0, 0, 1024, 400);
  g.font = `900 92px ${FONT}`;
  g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle';
  // نرسم الكلمات من اليمين إلى اليسار، والمجموعة منها بالذهبي
  const gap = 26;
  const widths = words.map((w) => g.measureText(w).width);
  const lines = [[]]; let lw = 0;
  words.forEach((w, i) => { if (lw + widths[i] > 940 && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += widths[i] + gap; });
  lines.forEach((ln, li) => {
    const total = ln.reduce((s, i) => s + widths[i] + gap, -gap);
    let x = 512 + total / 2;
    const y = 200 + (li - (lines.length - 1) / 2) * 130;
    ln.forEach((i) => {
      g.fillStyle = i < n ? '#ffd23f' : 'rgba(255,255,255,0.9)';
      g.fillText(words[i], x, y);
      x -= widths[i] + gap;
    });
  });
  if (!lib.doorText) {
    lib.doorText = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4 * 400 / 1024), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    lib.doorText.position.set(0, 3.4, 0.4);
    lib.door.add(lib.doorText);
  } else {
    lib.doorText.material.map.dispose();
    lib.doorText.material.map = new THREE.CanvasTexture(c);
  }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------------- الممر الرئيسي والغرف ---------------- */
// الممر بعيد على المحور x (HX)، والغرف صفّ بعيد آخر (RX0). كل غرفة تُبنى أول مرة يدخلها اللاعب.
const HX = -300, RX0 = 600, ROOM_GAP = 50;
const hall = { doors: [], built: false };
const rooms = [];
function roomPos(i) { return new V3(RX0 + i * ROOM_GAP, 0, 0); }

function buildHall() {
  const floor = mesh(new THREE.PlaneGeometry(14, 92), new THREE.MeshLambertMaterial({ map: marbleTex(4, 26) }), HX, 0, -40);
  floor.rotation.x = -PI / 2;
  const wallC = 0xf3e6cf, trimC = 0xd4a64a;
  solid(1, 7, 92, wallC, HX - 7, 3.5, -40);
  solid(1, 7, 92, wallC, HX + 7, 3.5, -40);
  solid(14, 7, 1, wallC, HX, 3.5, -86.5);
  solid(14, 7, 1, wallC, HX, 3.5, 6.5);
  const ceil = mesh(new THREE.PlaneGeometry(14, 92), mat(0xfaf3e6), HX, 7, -40); ceil.rotation.x = PI / 2;
  for (const s of [-1, 1]) {
    box(0.2, 0.25, 92, trimC, HX + s * 6.45, 1.1, -40);       // إطار ذهبي على الجدار
    box(0.2, 0.25, 92, trimC, HX + s * 6.45, 5.6, -40);
  }
  // مصابيح معلّقة ولافتات العبارات
  for (let z = 0; z > -84; z -= 10) {
    cyl(0.02, 0.02, 1.2, 0x333333, HX, 6.4, z);
    sphere(0.45, mat(0xffe2a6, { emissive: 0xffc56b, emissiveIntensity: 0.9 }), HX, 5.7, z, scene, 12);
    glow(0xffd27a, 3.5, scene).position.set(HX, 5.7, z);
  }
  const hl = new THREE.PointLight(0xffe3b8, 0.7, 60); hl.position.set(HX, 6, -40); scene.add(hl);
  const hallSign = signPlane(SC.hall, 6, { size: 80, color: '#f6d27a', bg: '#1d2a5c', border: '#d4a64a', maxW: 900 });
  hallSign.position.set(HX, 5.6, -85.9);
  SC.hallMottos.forEach((t, i) => {
    const sp = signPlane(t, 3.6, { size: 56, color: '#1d2a5c', bg: '#fbf6ea', border: '#d4a64a', maxW: 700 });
    const s = i % 2 ? 1 : -1;
    sp.position.set(HX + s * 6.38, 4.4, -14 - i * 18.5);
    sp.rotation.y = -s * PI / 2;
  });
  // أبواب الغرف: 12 على الجانبين، والممر السري في النهاية
  SC.rooms.forEach((room, i) => {
    const secret = i === 12;
    const s = secret ? 0 : (i % 2 ? 1 : -1);
    const z = secret ? -85.8 : -9 - Math.floor(i / 2) * 13;
    const g = new THREE.Group();
    g.position.set(secret ? HX : HX + s * 6.45, 0, z);
    g.rotation.y = secret ? 0 : -s * PI / 2;
    scene.add(g);
    const color = new THREE.Color(room.color).getHex();
    box(3.6, 4.6, 0.3, trimC, 0, 2.3, 0, g);
    const leaf = box(2.8, 4, 0.2, mat(color, { emissive: color, emissiveIntensity: 0.15 }), 0, 2, 0.15, g);
    sphere(0.1, 0xffd23f, -1, 2, 0.3, g, 8);
    const sign = signPlane(room.name, 3.2, { size: 54, color: '#fff', bg: room.color, border: '#f6d27a', maxW: 700 }, g);
    sign.position.set(0, 4.9, 0.25);
    const glowSp = glow(color, 6, g); glowSp.position.set(0, 2.2, 0.8);
    const lk = label('🔒', 0.45, { bg: null, size: 80, pad: 4 }, g); lk.position.set(0, 2.2, 0.5);
    const ck = label('✅', 0.55, { bg: null, size: 80, pad: 4 }, g); ck.position.set(0, 3.4, 0.5);
    // خزائن بين الأبواب
    if (!secret) for (const dz of [-3.5, 3.5]) {
      const lz = z + dz;
      if (lz < -82 || lz > 2) continue;
      const lc = box(0.6, 2.6, 1.6, [0x5b8bd6, 0xe8504a, 0x2bb673, 0xf2a900][(i + (dz > 0 ? 1 : 0)) % 4], HX + s * 6.1, 1.3, lz);
      box(0.05, 2.3, 0.04, 0xffffff, HX + s * 5.79, 1.3, lz);
    }
    const front = new V3(secret ? HX : HX + s * 4.8, 0, secret ? -83.5 : z);
    hall.doors.push({ room, i, g, leaf, front, glow: glowSp, lock: lk, check: ck });
  });
  // باب الخروج إلى الساحة
  const back = new THREE.Group(); back.position.set(HX, 0, 6); scene.add(back);
  box(4.4, 5, 0.3, trimC, 0, 2.5, 0, back);
  box(3.6, 4.4, 0.2, 0x8e5cf7, 0, 2.2, -0.15, back);
  const out = signPlane('إلى الساحة', 2.6, { size: 54, color: '#1d2a5c', bg: '#fbf6ea', border: '#d4a64a' }, back);
  out.position.set(0, 4.8, -0.2); out.rotation.y = PI;
  hall.backFront = new V3(HX, 0, 3.5);
  // نجوم الممر: بعضها عالٍ يحتاج قفزة
  [[-3, -6, 1.1], [3, -19, 2.3], [-3, -32, 1.1], [3, -45, 2.3], [-3, -58, 1.1], [3, -71, 2.3], [0, -80, 1.1]].forEach(([dx, z, y], k) => addStar('h' + k, HX + dx, y, z));
  if (window.HALL_LOOK) HALL_LOOK.init({ scene, HX, G, hall, hemi, sun, mat, mesh, box, glow, canvasTex, texLoader, woodTex });   // الممر بأسلوب صورة الأستاذة: js/hall-look.js
  hall.built = true;
}

// غرفة: أرضية وجدران بلون الغرفة، وأثاث حسب نوعها، ووحشها نائم مع لافتة «المستوى القادم»
function buildRoom(i) {
  if (rooms[i]) return rooms[i];
  const room = SC.rooms[i];
  const c = roomPos(i), color = new THREE.Color(room.color);
  const hex = color.getHex(), light = color.clone().lerp(new THREE.Color(0xffffff), 0.75).getHex();
  const r = { i, room, objs: [] };
  const fl = mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshLambertMaterial({ map: marbleTex(6, 6) }), c.x, 0, c.z); fl.rotation.x = -PI / 2;
  solid(22, 6, 1, light, c.x, 3, c.z - 11.5);
  solid(1, 6, 24, light, c.x - 11.5, 3, c.z);
  solid(1, 6, 24, light, c.x + 11.5, 3, c.z);
  solid(9, 6, 1, light, c.x - 6.5, 3, c.z + 11.5);
  solid(9, 6, 1, light, c.x + 6.5, 3, c.z + 11.5);
  box(22, 0.4, 0.2, hex, c.x, 5.7, c.z - 10.95);
  const pl = new THREE.PointLight(0xfff0d8, 0.8, 40); pl.position.set(c.x, 5, c.z); scene.add(pl);
  const title = signPlane(room.name, 7, { size: 90, color: '#fff', bg: room.color, border: '#f6d27a', maxW: 1200 });
  title.position.set(c.x, 4.6, c.z - 10.9);
  // باب الخروج
  solid(4, 4.6, 0.3, 0xd4a64a, c.x, 2.3, c.z + 11.2);
  const exitSign = signPlane('إلى الممر', 2.2, { size: 50, color: '#1d2a5c', bg: '#fbf6ea', border: '#d4a64a' });
  exitSign.position.set(c.x, 4.9, c.z + 10.95); exitSign.rotation.y = PI;
  r.exitFront = new V3(c.x, 0, c.z + 9.6);

  const T = room.theme;
  const desk = (x, z, w = 1.4) => { box(w, 0.1, 0.8, 0xc58a4a, x, 0.8, z); for (const [dx, dz] of [[-w / 2 + 0.1, -0.3], [w / 2 - 0.1, -0.3], [-w / 2 + 0.1, 0.3], [w / 2 - 0.1, 0.3]]) box(0.08, 0.8, 0.08, 0x6b4a2b, x + dx, 0.4, z + dz); addCol(x - w / 2, x + w / 2, z - 0.4, z + 0.4); };
  const board = (text) => {
    r.boardObjs = [
      box(10, 3.2, 0.2, 0x234a3a, c.x, 2.7, c.z - 10.8),
      box(10.4, 3.6, 0.15, 0x8b5a2b, c.x, 2.7, c.z - 10.9),
      signPlane(text, 8.5, { size: 90, color: '#ffffff', maxW: 1400 }),
    ];
    r.boardObjs[2].position.set(c.x, 2.7, c.z - 10.65);
  };
  r.title = title;
  if (T === 'board' || T === 'class' || T === 'tests') {
    board(room.board || (T === 'class' ? 'مرحبًا بكم في صف شتشوت' : 'لا تخف من الخطأ... الخطأ معلّم'));
    for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) desk(c.x + col * 4, c.z - 3 + row * 3.5);
  } else if (T === 'tree') {
    cyl(0.6, 0.9, 5, 0x8b5a2b, c.x, 2.5, c.z - 4);
    sphere(3, hex, c.x, 6, c.z - 4, scene, 14);
    (room.words || []).forEach((w, k) => { const lb = label(w, 0.7, { size: 64, border: room.color }); lb.position.set(c.x - 3 + k * 3, 3.6 + (k % 2) * 0.8, c.z - 2.5); });
    addCol(c.x - 0.9, c.x + 0.9, c.z - 4.9, c.z - 3.1);
  } else if (T === 'listening') {
    for (const s of [-1, 1]) { box(1.4, 2.6, 1.2, 0x2a2a3a, c.x + s * 7, 1.3, c.z - 8); sphere(0.45, 0x555577, c.x + s * 7, 1.9, c.z - 7.35, scene, 12); sphere(0.3, 0x555577, c.x + s * 7, 0.8, c.z - 7.35, scene, 10); addCol(c.x + s * 7 - 0.7, c.x + s * 7 + 0.7, c.z - 8.6, c.z - 7.4); }
    for (let k = 0; k < 6; k++) label('♪', 0.8, { bg: null, color: room.color, size: 100, pad: 4 }).position.set(c.x - 6 + k * 2.4, 4 + (k % 2), c.z - 6);
  } else if (T === 'stage') {
    box(14, 0.8, 6, 0x6b3e1f, c.x, 0.4, c.z - 7.5); addCol(c.x - 7, c.x + 7, c.z - 10.5, c.z - 4.5);
    for (const s of [-1, 1]) box(3, 5, 0.3, 0xb71c1c, c.x + s * 6, 3, c.z - 4.6);
    box(14, 1, 0.3, 0xb71c1c, c.x, 5.4, c.z - 4.6);
  } else if (T === 'review') {
    for (let k = -2; k <= 2; k++) { const kx = c.x + k * 3; box(1.6, 2.2, 0.8, 0x6b3e1f, kx, 1.1, c.z - 9.5); label('🔑', 0.6, { bg: null, size: 80, pad: 4 }).position.set(kx, 2.7, c.z - 9.4); }
    addCol(c.x - 7, c.x + 7, c.z - 10, c.z - 9);
  } else if (T === 'office') {
    if (!room.photo) desk(c.x, c.z - 6, 3);
    sphere(0.8, 0x4f9a45, c.x + 7, 1.6, c.z - 8, scene, 10); cyl(0.5, 0.4, 0.9, 0xfaf3e6, c.x + 7, 0.45, c.z - 8, scene, 12);
    r.note = signPlane(room.note, 6, { size: 80, color: '#1d2a5c', bg: '#fbf6ea', border: '#5b8bd6', maxW: 1000 });
    r.note.position.set(c.x, 2.6, c.z - 10.9);
    r.mongia = charSprite('mongia', 1.7);
    r.mongia.position.set(c.x, 0, c.z - 4);
    (window.extraChars = window.extraChars || []).push(r.mongia);
  } else if (T === 'secret') {
    for (let k = 0; k < 14; k++) { const sp = glow([0x8e5cf7, 0x5b8bd6, 0xe84d8a][k % 3], 0.6 + Math.random(), scene); sp.position.set(c.x - 9 + Math.random() * 18, 0.5 + Math.random() * 4, c.z - 9 + Math.random() * 14); }
  }
  // غرفة مهارة: وحشها، وبلاطات الإجابة، وقفص الصديق المحتجز
  const data = RC[room.id];
  if (data) {
    r.data = data;
    r.monster = makeRoomMonster(data.monster, new V3(c.x + 5.5, 0, c.z - 5.5));
    r.monsterCol = addCol(c.x + 4.3, c.x + 6.7, c.z - 6.7, c.z - 4.3);
    r.tiles = [-5.4, -1.8, 1.8, 5.4].map((dx) => {
      const t = box(3.2, 0.12, 2.2, 0xfff3d6, c.x + dx, 0.06, c.z + 3.6);
      const lb = label(' ', 0.8, { size: 80, border: room.color, minW: 200 });
      lb.position.set(c.x + dx, 1.9, c.z + 3.6); lb.visible = false;
      return { x: c.x + dx, z: c.z + 3.6, mesh: t, lb, word: '', on: false };
    });
    if (data.captive || data.boss) {
      const cx = c.x - 7, cz = c.z - 5.5;
      r.cage = new THREE.Group(); r.cage.position.set(cx, 0, cz); scene.add(r.cage);
      box(2.8, 0.25, 2.8, 0x4a3a6a, 0, 0.12, 0, r.cage);
      box(2.8, 0.2, 2.8, 0x4a3a6a, 0, 3.1, 0, r.cage);
      r.bars = [];
      for (let k = 0; k < 7; k++) for (const [sx, sz] of [[-1.3 + k * 0.43, 1.3], [-1.3 + k * 0.43, -1.3], [1.3, -1.3 + k * 0.43], [-1.3, -1.3 + k * 0.43]]) {
        r.bars.push(cyl(0.05, 0.05, 3, mat(hex, { emissive: hex, emissiveIntensity: 0.4 }), sx, 1.6, sz, r.cage, 6));
      }
      r.cageCol = addCol(cx - 1.4, cx + 1.4, cz - 1.4, cz + 1.4);
      if (data.captive) r.captive = yard.friends[1 + Object.keys(STUDENTS).indexOf(data.captive.sprite)];
      else {
        r.held = charSprite('mongia', 1.7);
        r.held.position.set(cx, 0, cz);
        (window.extraChars = window.extraChars || []).push(r.held);
        r.monster.boss = 1.7;
      }
      r.cagePos = new V3(cx, 0, cz);
    }
  }
  if (T === 'class') {          // الأصدقاء المُنقَذون يعودون إلى مقاعدهم
    r.seats = ['salem', ...Object.keys(STUDENTS)].map((k, n) => {
      const sp = charSprite(k, 1.15);
      sp.position.set(c.x + (n % 3 - 1) * 4, 0, c.z - 2.2 + Math.floor(n / 3) * 3.5);
      (window.extraChars = window.extraChars || []).push(sp);
      return { k, sp };
    });
  }
  if (T === 'secret') {         // كتاب الصداقة في آخر الممر السري
    r.book = new THREE.Group(); r.book.position.set(c.x, 0, c.z - 6); scene.add(r.book);
    cyl(1.2, 1.4, 1, 0xd4a64a, 0, 0.5, 0, r.book, 16);
    const pg = box(2.2, 0.2, 1.5, 0xfffaf0, 0, 1.15, 0, r.book); pg.rotation.x = -0.3;
    r.bookGlow = glow(0xffd23f, 6, r.book); r.bookGlow.position.y = 1.6;
    label('الكتاب المخفي', 0.5, { size: 60, border: '#d4a64a' }, r.book).position.y = 2.8;
    addCol(c.x - 1.4, c.x + 1.4, c.z - 7.4, c.z - 4.6);
  }
  // نجمتان في كل غرفة، إحداهما عالية
  if (room.theme !== 'library') { addStar('r' + i + 'a', c.x - 9, 1.1, c.z + 8); addStar('r' + i + 'b', c.x + 9, 2.3, c.z + 8); }
  if (room.photo) roomPhotoLook(r, c, room);
  rooms[i] = r;
  return r;
}

// غرفة لها صورة مكان حقيقية (room.photo في level1.js): الصورة كاملة بنسبتها على الجدار الخلفي،
// والجدران أعلى، ورخام دافئ لامع، وفوانيس؛ والوحش والبلاطات والقفص فوقها كما هي.
function roomPhotoLook(r, c, room) {
  const W = 22, H = W * (room.photoH || 941) / (room.photoW || 1672);
  const back = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: texLoader.load(room.photo), fog: false }), c.x, H / 2, c.z - 10.97);
  back.renderOrder = -1;
  if (room.theme === 'office' && r.mongia) {
    // الأستاذة منجية جالسة خلف المكتب: شخصيتها أمام الصورة، وفوقها قطعة المكتب من الصورة نفسها فتخفي نصفها السفلي
    const px = W / (room.photoW || 1672), PW = room.photoW || 1672, PH = room.photoH || 941;
    const X0 = 545, X1 = 1125, Y0 = 472, Y1 = 668;
    const m = r.mongia;
    const big = 3.6 / 1.7;   // بحجم الكرسي في الصورة
    m.scale.set(big, big, 0.12); m.userData.seated = true; m.userData.speakerH = 3.6; m.rotation.y = 0;
    m.position.set(c.x + (842 - PW / 2) * px, (PH - 352) * px - 3.6, c.z - 10.84);
    const g = new THREE.PlaneGeometry((X1 - X0) * px, (Y1 - Y0) * px), uv = g.attributes.uv;
    uv.setXY(0, X0 / PW, 1 - Y0 / PH); uv.setXY(1, X1 / PW, 1 - Y0 / PH); uv.setXY(2, X0 / PW, 1 - Y1 / PH); uv.setXY(3, X1 / PW, 1 - Y1 / PH);
    mesh(g, new THREE.MeshBasicMaterial({ map: back.material.map, fog: false }), c.x + ((X0 + X1) / 2 - PW / 2) * px, (PH - (Y0 + Y1) / 2) * px, c.z - 10.72);
    r.talkAt = new V3(c.x, 0, c.z - 9);
  }
  (r.boardObjs || []).forEach((o) => { o.visible = false; });     // السبورة في الصورة نفسها
  if (r.title) r.title.position.y = H - 0.9;                       // اسم الغرفة فوق الصورة
  if (r.note) r.note.position.y = H - 2.4;                         // عبارة الأستاذة تحت اسم الغرفة، لا فوق المكتب
  const wallM = mat(0xf0dcc0);
  for (const s of [-1, 1]) { const w = mesh(new THREE.PlaneGeometry(24, H - 6), mat(0xe9d2b0, { side: THREE.DoubleSide }), c.x + s * 11, 6 + (H - 6) / 2, c.z); w.rotation.y = s * PI / 2; }
  mesh(new THREE.PlaneGeometry(22, H - 6), mat(0xe9d2b0, { side: THREE.DoubleSide }), c.x, 6 + (H - 6) / 2, c.z + 11);
  const ceil = mesh(new THREE.PlaneGeometry(22, 24), mat(0x3a2a5a, { side: THREE.DoubleSide }), c.x, H, c.z); ceil.rotation.x = PI / 2;
  scene.traverse((o) => {
    if (!o.isMesh || Math.abs(o.position.x - c.x) > 12 || Math.abs(o.position.z - c.z) > 12) return;
    if (o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width === 22 && o.geometry.parameters.height === 22 && o.position.y === 0)
      o.material = new THREE.MeshPhongMaterial({ map: marbleTex(6, 6), color: 0xcfb08a, shininess: 80, specular: 0x8a6038 });
    else if (o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height === 6) o.material = wallM;
    else if (o.geometry.type === 'BoxGeometry' && o.geometry.parameters.width === 22 && o.geometry.parameters.height === 0.4) o.visible = false;   // شريط اللون فوق الصورة
    // الشجرة المجسّمة تختفي حين تكون الشجرة في الصورة نفسها (غرفة المفردات والحفظ)
    // المسرح والستائر المجسّمة في مسرح التعبير: المسرح في الصورة نفسها
    else if (room.theme === 'stage' && o.geometry.type === 'BoxGeometry' && ((o.geometry.parameters.width === 14) || (o.geometry.parameters.width === 3 && o.geometry.parameters.height === 5))) o.visible = false;
    // خزائن المفاتيح المجسّمة في غرفة المراجعة: الصناديق والمفاتيح في الصورة نفسها
    else if (room.theme === 'review' && Math.abs(o.position.z - (c.z - 9.5)) < 0.2 && (o.geometry.type === 'BoxGeometry' || Math.abs(o.position.y - 2.7) < 0.1)) o.visible = false;
    else if (room.theme === 'tree' &&((o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height === 5) || (o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 3))) o.visible = false;
  });
  for (const [x, z] of [[-10.6, -6], [10.6, -6], [-10.6, 3], [10.6, 3]]) {
    const l = lantern(c.x + x, c.z + z, 3.6); l.children[0].visible = false;   // فانوس جداري بلا عمود
  }
  const warm = new THREE.PointLight(0xffb060, 0.6, 30); warm.position.set(c.x, 6, c.z); scene.add(warm);
}

/* ---------------- وحوش الغرف ---------------- */
// كل وحش يُبنى من وصفه في content/rooms.js: الشكل واللون وعدد العيون والرموز التي تدور حوله.
function makeRoomMonster(d, pos) {
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const inner = new THREE.Group(); g.add(inner);
  const col = new THREE.Color(d.color).getHex();
  const skin = mat(col, { emissive: col, emissiveIntensity: 0.18 });
  const c = creature(inner, d, skin, col);
  const orbit = (d.orbit || []).map((ch, k) => ({ l: label(ch, 0.6, { bg: null, color: '#ffffff', stroke: d.color, size: 90, pad: 8 }, g), a: k / d.orbit.length * PI * 2 }));
  const name = label(d.name, 0.5, { size: 54, border: d.color }, g);
  name.position.y = c.top + 0.9;
  return { g, inner, eyes: c.eyes, mouth: c.mouth, arms: c.arms, tail: c.tail, orbit, name, top: c.top, scale: 1, target: 1, hurt: 0, laugh: 0, happy: false, data: d };
}
function setRoomHealth(h) {
  if (HW.pending(roomRun.r.room.id)) h = Math.max(8, h);   // لا يُهزم الوحش تمامًا قبل الواجب
  roomRun.health = Math.min(100, Math.max(0, h));
  const rage = h > 0 && h <= 25 ? 2 : h > 0 && h <= 55 ? 1 : 0;
  if (rage > (roomRun.rage || 0)) {             // يغضب: أسرع في المطاردة وأقصر في وقت الهجوم
    roomRun.rage = rage;
    const m = roomRun.r.monster;
    m.laugh = 1; SFX.play('growl');
    burst(m.g.position.clone().add(new V3(0, 2, 0)), 0xff5252, 30, 6);
    toast(`😡 ${roomRun.r.data.monster.name}: ${rage === 1 ? 'لن تهزمني بسهولة!' : 'سأقاوم حتى آخر لحظة!'}`, 'bad', 2800);
  }
  $('monsterFill').style.width = roomRun.health + '%';
  roomRun.r.monster.target = (0.55 + 0.6 * roomRun.health / 100) * (roomRun.r.monster.boss || 1);
}
// الوحش المهزوم يصير صغيرًا لطيفًا مبتسمًا
function befriendMonster(m) {
  m.happy = true; m.target = 0.42;
  m.orbit.forEach((o) => { o.l.visible = false; });
  if (m.mouth) { m.mouth.scale.set(0.7, 1, 1); m.mouth.material = mat(0xff6b8a); }
  setLabel(m.name, m.data.name + ' الصغير 💛');
}

/* ---------------- تحديات الغرف ---------------- */
let roomRun = null;      // التحدي الجاري في الغرفة الحالية
function roomWords(lines, r) {
  // «friend» في المحتوى هو الصديق المحتجز في هذه الغرفة، و«monster» هو وحشها
  const d = r.data, mk = 'rm_' + r.room.id;
  C.names[mk] = d.monster.name;
  SPEAKER[mk] = { color: d.monster.color, face: '👾', bg: '#fff3f0' };
  return lines.map((l) => Object.assign({}, l, { who: l.who === 'friend' ? (d.captive ? d.captive.sprite : 'shtshouta') : l.who === 'monster' ? mk : l.who }));
}
function setRiddle(small, text) {
  const s = document.createElement('small'); s.textContent = small;
  $('riddle').replaceChildren(s, document.createTextNode(text));
}
function riddleText(text) {
  const rr = roomRun;
  setRiddle(`${rr.r.data.monster.name} · ${RX.step.replace('{n}', Math.min(rr.total, rr.done + 1)).replace('{total}', rr.total)}`, text);
  $('riddle').hidden = false;
}
const wrongMsg = () => RX.wrong[Math.random() * RX.wrong.length | 0];
function hitMonster() {
  const rr = roomRun, m = rr.r.monster;
  gainSkill(rr.r.room.id);
  rr.done++;
  friendStrike();
  setRoomHealth(Math.max(rr.done < rr.total ? 6 : 0, 100 - rr.done / rr.total * 100 + (rr.heal || 0)));
  setEnergy(G.energy + 3);
  m.hurt = 0.6; SFX.play('hit');
  burst(m.g.position.clone().add(new V3(0, 2, 0)), new THREE.Color(m.data.color).getHex(), 26, 5);
}
// الزملاء المحرَّرون يشاركون: يضربون الوحش مع البطل، ويجيبون حين يُسألون، ويعترضون الوحش في المطاردة
const freedFriends = () => team.filter((t) => t.obj !== shtshout && t.obj !== shtshouta);
function friendStrike() {
  const list = freedFriends(), rr = roomRun;
  if (!list.length) return;
  const f = list[Math.random() * list.length | 0], m = rr.r.monster;
  rr.heal = (rr.heal || 0) - 3;
  burst(f.obj.position.clone().add(new V3(0, 1.2, 0)), 0x7be3a6, 14, 3);
  burst(m.g.position.clone().add(new V3(0, 2, 0)), 0xffd23f, 14, 4);
  toast(`💥 ${f.name} يضرب الوحش معك!`, 'good', 2000);
}
function refreshAsk() {
  const rr = roomRun, st = rr && rr.cur && rr.cur.st;
  const can = !!st && (st.type === 'tiles' || st.type === 'choose') && !rr.askedNow;
  const f = can ? freedFriends().find((t) => !(rr.asked || []).includes(t.obj)) : null;
  $('btnAsk').hidden = !f;
  if (f) $('btnAsk').textContent = `🙋 اسأل ${f.name} (H)`;
  $('fightBar').hidden = !f && !(rr && rr.attackMax);
}
function askFriend() {
  const rr = roomRun, st = rr && rr.cur && rr.cur.st;
  if (!st || $('btnAsk').hidden) return;
  const f = freedFriends().find((t) => !(rr.asked || []).includes(t.obj));
  if (!f) return;
  (rr.asked = rr.asked || []).push(f.obj);
  rr.askedNow = true;
  let wrong = '';
  if (st.type === 'tiles') {
    const t = shuffle(rr.r.tiles.filter((x) => x.on && x.word !== st.answer))[0];
    if (t) { wrong = t.word; t.on = false; t.lb.visible = false; }
  } else {
    const b = shuffle([...$('quizOpts').querySelectorAll('button:not([disabled])')].filter((x) => x.textContent !== st.answer))[0];
    if (b) { wrong = b.textContent; b.disabled = true; b.classList.add('no'); }
  }
  burst(f.obj.position.clone().add(new V3(0, 1.2, 0)), 0x7be3a6, 12, 3);
  if (wrong) toast(`${f.name}: أنا متأكد أن «${wrong}» ليست الجواب!`, 'good', 3200);
  refreshAsk();
}
function startAttack(sec) {
  const rr = roomRun;
  rr.attackMax = sec * (1 - 0.15 * (rr.rage || 0));
  rr.attackLeft = rr.attackMax;
  refreshAsk();
}
function stopAttack() { const rr = roomRun; if (rr) rr.attackMax = 0; $('attackFill').style.width = '0'; $('attackText').textContent = ''; refreshAsk(); }
function attackSeconds(st) {
  if (st.type === 'order' || st.type === 'memory') return 20 + (st.items ? st.items.length : 5) * 6;
  return (st.listen ? 50 : 38) - G.grade;
}
// طاقة البطل: تنقص مع الخطأ وانتهاء وقت الواجب فيبطؤ، وتعود بالنجوم والإجابات الصحيحة وإنقاذ الغرف
function setEnergy(v) { G.energy = Math.max(0, Math.min(100, v)); save(); }
function hurtHero(n = 10) {
  setEnergy(G.energy - n);
  burst(P.pos.clone().setY(1.2), 0xff6b6b, 10, 3);
  if (G.energy <= 0) {
    // البطل منهك: يستعيد الوحش بعض قوته، ويعود للبطل نصف طاقته ليكمل (بلا خسارة نهائية)
    setEnergy(50);
    if (roomRun) { roomRun.heal = (roomRun.heal || 0) + 15; setRoomHealth(roomRun.health + 15); }
    toast('بطلك منهك! استعاد الوحش بعض قوته. خذ نفسًا وركّز 💪', 'bad', 3200);
  }
  warnHero(G.energy < 40 ? 'warn-4' : 'warn-5');
}
// تحذيرات شتشوت وشتشوتة بالصوت أثناء اللعب، دون إيقاف اللعب
const warnVoice = new Audio();
let warnAt = 0;
function warnHero(id) {
  const src = VOICES[id], now = performance.now();
  if (!src || now - warnAt < 8000 || !$('dialog').hidden || G.paused) return;
  if (!$('quiz').hidden && !$('quizListen').hidden) return;     // لا نغطي على مقطع الاستماع
  warnAt = now;
  warnVoice.muted = voice.muted;
  warnVoice.src = src;
  warnVoice.play().catch(() => {});
}
function starsNearby() {
  const list = G.area === 'library' ? lib.stars : G.area === 'room' ? extraStars.filter((s) => s.id && s.id.startsWith('r' + G.room)) : [];
  return list.some((s) => s.obj.visible);
}
function warnMonster() { warnHero(starsNearby() ? 'warn-' + (Math.random() * 4 | 0) : 'warn-5'); }
// كل خطأين يعيد الوحش السؤال نفسه تحديًا إضافيًا (حتى ثلاث مرات)، فلا يفوز الطالب دون أن يتقنه
function monsterResists() {
  const rr = roomRun;
  rr.heal = (rr.heal || 0) + 6;
  setRoomHealth(rr.health + 6);
  rr.misses = (rr.misses || 0) + 1;
  if (rr.misses % 2 === 0 && (rr.extras || 0) < 3 && rr.cur && rr.queue) {
    rr.extras = (rr.extras || 0) + 1;
    rr.total++;
    rr.queue.push(rr.cur);
    tip(`🛡️ ${rr.r.data.monster.name} يقاوم! أضاف تحديًا جديدًا`);
  }
}
function missMonster() { if (roomRun) { roomRun.r.monster.laugh = 0.8; roomRun.wrong++; monsterResists(); } hurtHero(); SFX.play('bad'); }

// تحدي البلاطات: يقف اللاعب على البلاطة التي تحمل الجواب
// وحش الإملاء يطارد البطل أثناء البلاطات؛ إذا أمسكه أو أخطأ عاد إلى الباب وتغيّرت أماكن الإجابات
function monsterHome(r) {
  const c = roomPos(r.i);
  r.monster.g.position.set(c.x + 5.5, 0, c.z - 5.5);
  r.monsterCol.on = true;
}
async function roomCaught(hurt) {
  const rr = roomRun, r = rr.r;
  if (rr.catching) return;
  rr.catching = true;
  G.lock++;
  if (hurt) hurtHero(hurt);
  SFX.play('boo');
  r.monster.laugh = 1;
  burst(P.pos.clone().setY(1), 0xff6b6b, 24, 4);
  toast('أمسكك الوحش! عُد إلى الباب وحاول من جديد', 'bad', 2600);
  await fade(true, true);
  placePlayer(r.exitFront.x, r.exitFront.z - 3.5, PI);
  monsterHome(r);
  if (rr.layout) rr.layout();
  rr.chaseWait = 3.5; rr.chaseOn = true; rr.lastTile = null;
  await fade(false);
  G.lock--;
  rr.catching = false;
}
function stepTiles(st) {
  const rr = roomRun;
  return new Promise((res) => {
    rr.layout = () => {
      const opts = shuffle(st.options.slice());
      rr.r.tiles.forEach((t, k) => {
        const w = opts[k];
        t.word = w || ''; t.on = !!w; t.lb.visible = !!w; t.mesh.material = mat(0xfff3d6);
        if (w) setLabel(t.lb, w);
      });
    };
    rr.layout();
    rr.chaseOn = !!rr.chase; rr.chaseWait = 3.5;
    riddleText(st.q + ' ← قف على الجواب');
    let wrongHere = 0;
    rr.onTile = (t) => {
      if (t.word === st.answer) {
        SFX.play('good'); t.mesh.material = mat(0x7be3a6); toast(`صحيح! «${st.answer}»`, 'good');
        rr.r.tiles.forEach((tt) => { tt.on = false; });
        rr.onTile = null;
        if (rr.chase) { rr.chaseOn = false; monsterHome(rr.r); }
        wait(0.9).then(() => { rr.r.tiles.forEach((tt) => { tt.lb.visible = false; tt.mesh.material = mat(0xfff3d6); }); res(); });
      } else {
        missMonster(); wrongHere++;
        t.mesh.material = mat(0xffb3b3);
        wait(0.9).then(() => { if (t.on) t.mesh.material = mat(0xfff3d6); });
        if (rr.chase) { roomCaught(0).then(() => toast(`«${t.word}»: ${wrongMsg()}${wrongHere >= 2 ? ' ' + rr.r.data.hint : ''}`, 'bad', 3600)); return; }
        toast(`«${t.word}»: ${wrongMsg()}${wrongHere >= 2 ? ' ' + rr.r.data.hint : ''}`, 'bad', 3600);
      }
    };
  });
}
// صوت جملة الاستماع: الملف المسجّل إن وُجد، وإلا صوت المتصفح العربي
function speak(id, text) {
  const src = VOICES[id];
  if (SFX.muted) return Promise.resolve(false);
  if (src) { voice.src = src; voice.currentTime = 0; return voice.play().then(() => true).catch(() => false); }
  const arVoice = window.speechSynthesis && speechSynthesis.getVoices().find((v) => /^ar/i.test(v.lang));
  if (arVoice) {
    const u = new SpeechSynthesisUtterance(text); u.lang = arVoice.lang; u.voice = arVoice; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
// سؤال واختيارات في لوحة (مع الاستماع عند الحاجة)
function openQuiz(st, title, listenId) {
  return new Promise((resolve) => {
    G.lock++;
    const opts = $('quizOpts'), fb = $('quizFb');
    $('quizTitle').textContent = title;
    $('quizQ').textContent = st.q;
    fb.textContent = '';
    let wrongHere = 0;
    const lb = $('quizListen');
    lb.hidden = !st.listen;
    if (st.listen) {
      const play = () => speak(listenId, st.listen).then((ok) => { if (!ok) $('quizQ').textContent = '«' + st.listen + '» — ' + st.q; });
      lb.onclick = play;
      setTimeout(play, 350);
    }
    opts.innerHTML = '';
    shuffle(st.options.slice()).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'page-card'; b.textContent = o;
      b.onclick = () => {
        if (o === st.answer) {
          b.classList.add('ok'); fb.style.color = '#2bb673'; fb.textContent = 'أحسنت! 🎉'; SFX.play('good');
          opts.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          setTimeout(() => { $('quiz').hidden = true; G.lock--; resolve(); }, 1000);
        } else {
          b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 500);
          missMonster(); wrongHere++;
          fb.style.color = '#ff6b6b';
          fb.textContent = wrongMsg() + (wrongHere >= 2 && roomRun ? ' ' + roomRun.r.data.hint : '');
        }
      };
      opts.appendChild(b);
    });
    $('quiz').hidden = false;
  });
}
// الحفظ: تظهر الكلمات ثوانيَ ثم تختفي، ثم يرتّبها اللاعب من ذاكرته
async function stepMemory(st, title) {
  G.lock++;
  $('quizTitle').textContent = title;
  $('quizListen').hidden = true;
  $('quizQ').textContent = 'احفظ هذه الكلمات بالترتيب! كرّرها في سرّك.';
  const memBox = document.createElement('div'); memBox.className = 'quiz-mem';
  st.items.forEach((x) => { const sp = document.createElement('span'); sp.textContent = x; memBox.appendChild(sp); });
  $('quizOpts').replaceChildren(memBox);
  $('quiz').hidden = false;
  for (let k = st.show; k > 0; k--) { $('quizFb').style.color = '#5a33b8'; $('quizFb').textContent = '⏳ ' + k; await wait2(1000); }
  $('quiz').hidden = true;
  G.lock--;
  startAttack(attackSeconds(st));
  await openOrder({ title: st.title || 'رتّب الكلمات كما رأيتها', hint: 'مِمْحاة مسح الكلمات! استرجعها من ذاكرتك.', items: st.items, poolH: 'الكلمات', slotsH: 'بالترتيب الذي رأيته', hint2: 'أغمض عينيك وتذكّر الصورة.' });
}
// المراجعة: مفاتيح مضيئة في أرجاء الغرفة، عند كل مفتاح سؤال من غرفة سابقة
function stepCollect(st) {
  const rr = roomRun, c = roomPos(rr.r.i);
  const spots = [[-8, 6], [8, 6], [-8, -1], [8, -1.5], [0, -1.5], [-3, 7.5], [3, 7.5]];
  return new Promise((res) => {
    let got = 0;
    rr.keys = st.items.map((it, k) => {
      const g = new THREE.Group(); g.position.set(c.x + spots[k][0], 1.2, c.z + spots[k][1]); scene.add(g);
      label('🔑', 0.9, { bg: null, size: 100, pad: 4 }, g);
      glow(0xffd23f, 2.4, g);
      return { g, it, done: false, busy: false };
    });
    riddleText(`اجمع مفاتيح المعرفة 🔑 ${got} من ${st.items.length}`);
    rr.chaseOn = true; rr.chaseWait = 3.5;
    rr.onKey = async (key) => {
      key.busy = true;
      rr.cur = { st: Object.assign({ type: 'choose' }, key.it) }; rr.askedNow = false;
      startAttack(attackSeconds(key.it));
      await openQuiz(key.it, 'مفتاح المعرفة 🔑');
      stopAttack();
      key.done = true; key.g.visible = false; got++;
      burst(key.g.position, 0xffd23f, 20, 4);
      hitMonster();
      riddleText(`اجمع مفاتيح المعرفة 🔑 ${got} من ${st.items.length}`);
      if (got >= st.items.length) { rr.onKey = null; res(); }
    };
  });
}

// واجب المعلم: ينزّله الطالب أو يسلّمه قبل الضربة الأخيرة
async function homeworkGate(id) {
  if (!HW.pending(id)) return;
  $('riddle').hidden = true;
  G.lock++;
  await HW.gate(id);
  G.lock--;
}
// أخطاء إملائية مقنعة تُولَّد من الكلمة نفسها، حين لا يكتب المعلم الخيارات الخاطئة
const SIMILAR = ['أإاءؤئ', 'ةهت', 'ضظد', 'ذزد', 'سص', 'تط', 'ىاي', 'قك', 'حه'];
function misspell(word) {
  const out = new Set(), ch = [...word];
  ch.forEach((c, i) => SIMILAR.forEach((g) => {
    if (!g.includes(c)) return;
    for (const v of g) if (v !== c) out.add(ch.slice(0, i).join('') + v + ch.slice(i + 1).join(''));
  }));
  out.delete(word);
  return shuffle([...out]);
}
const orderStep = (w) => { const plain = w.replace(/[\u064B-\u0652]/g, ''); return { type: 'order', title: `أعد حروف الكلمة إلى مكانها: «${plain}»`, items: [...plain] }; };
// أسئلة عدّلها المعلم لهذا الصف والغرفة (على جهازه وعند من يفتح رابطه أو ملفه فقط)
function customSteps(id) {
  const cu = HW.custom(G.grade, id);
  if (!Array.isArray(cu) || !cu.length) return null;
  const list = cu.map((s) => Object.assign({ custom: true }, s));
  const g = gradeData(), base = (g && g[id] && g[id].steps) || BASE_CONTENT.steps[id];
  if (base.some((s) => s.type === 'collect')) {     // غرفة المراجعة: أسئلة المعلم عند مفاتيح المعرفة
    return [{ type: 'collect', items: list.filter((s) => s.options).slice(0, 7) }];
  }
  return shuffle(list);
}
// كل أسئلة الغرفة لهذا الصف، لتظهر في لوحة المعلم
function teacherBank(grade, id) {
  const g = (window.GRADES || {})[grade];
  if (id === 'library') {
    const l = (g && g.library) || {};
    return { pages: l.pages || BASE_CONTENT.pages, rounds: l.rounds || BASE_CONTENT.rounds };
  }
  const base = (g && g[id] && g[id].steps) || BASE_CONTENT.steps[id] || [];
  const flat = base.flatMap((s) => (s.type === 'collect' ? s.items.map((x) => Object.assign({ type: 'choose' }, x)) : [s]));
  const pool = id === 'spelling' ? ((window.SPELLING_POOLS || {})[grade] ? window.SPELLING_POOLS[grade].tiles.map((s) => Object.assign({ type: 'tiles' }, s)).concat(window.SPELLING_POOLS[grade].words.map(orderStep)) : []) : ((window.ROOM_POOLS || {})[id] || {})[grade] || [];
  return flat.concat(pool);
}
function spellingSteps() {
  const custom = HW.words();
  if (custom) {
    const steps = [];
    custom.list.forEach((x) => {
      const wrong = x.w.concat(misspell(x.a).filter((v) => !x.w.includes(v))).slice(0, 3);
      if (wrong.length) steps.push({ type: 'tiles', q: `${custom.topic ? custom.topic + ': ' : ''}أيّ الكتابات صحيحة؟`, answer: x.a, options: [x.a, ...wrong] });
      steps.push(orderStep(x.a));
    });
    return steps;
  }
  const cu = customSteps('spelling');
  if (cu) return cu;
  const g = gradeData(), base = (g && g.spelling && g.spelling.steps) || BASE_CONTENT.steps.spelling;
  const pool = (window.SPELLING_POOLS || {})[G.grade];
  if (!pool) return base;
  const tiles = shuffle(pool.tiles.concat(base.filter((s) => s.type === 'tiles')).map((s) => Object.assign({ type: 'tiles' }, s))).slice(0, 6);
  const words = shuffle(pool.words.slice()).slice(0, 3).map(orderStep);
  return [tiles[0], tiles[1], words[0], tiles[2], tiles[3], words[1], tiles[4], tiles[5], words[2]];
}
// بنك أسئلة الغرفة حسب الصف: في كل دخول مزيج جديد من الأسئلة
function roomSteps(id) {
  const cu = customSteps(id);
  if (cu) return cu;
  const g = gradeData(), base = (g && g[id] && g[id].steps) || BASE_CONTENT.steps[id];
  const pool = ((window.ROOM_POOLS || {})[id] || {})[G.grade];
  if (!pool) return base;
  const all = pool.concat(base);
  const take = (type, n) => shuffle(all.filter((s) => s.type === type)).slice(0, n);
  if (id === 'mongia') return shuffle([...take('tiles', 6), ...take('choose', 6)]);   // المعركة الأخيرة أطول
  return shuffle([...take('tiles', 5), ...take('choose', 3), ...take('order', 2)]);
}
async function startRoomFight(r) {
  const d = r.data, c = roomPos(r.i);
  d.steps = r.room.id === 'spelling' ? spellingSteps() : roomSteps(r.room.id);
  const units = d.steps.reduce((n, st) => n + (st.type === 'collect' ? st.items.length : 1), 0);
  roomRun = { r, active: true, done: 0, total: units, health: 100, wrong: 0, onTile: null, onKey: null, keys: [], chase: true };
  $('monsterName').textContent = d.monster.name;
  setRoomHealth(100);
  $('monsterBar').hidden = false;
  G.lock++;
  const m = r.monster;
  m.scale = 0.05;
  await camTo(new V3(c.x + 1, 3, c.z + 3), m.g.position.clone().add(new V3(0, 1.6, 0)), 0.9);
  SFX.play('growl');
  burst(m.g.position.clone().add(new V3(0, 1.5, 0)), new THREE.Color(d.monster.color).getHex(), 30, 5);
  if (r.captive) await camTo(new V3(c.x - 3, 3, c.z + 1), r.cagePos.clone().add(new V3(0, 1.3, 0)), 1);
  await camTo(new V3(c.x + 0.5, 3.2, c.z + 4), m.g.position.clone().add(new V3(0, 1.6, 0)), 0.5);
  await say(roomWords(d.intro, r));
  G.cam = null;
  G.lock--;
  toast('🎯 ' + d.goal, 'good', 5200);
  const queue = d.steps.map((st, k) => ({ st, k }));
  roomRun.queue = queue;
  for (let q = 0; q < queue.length; q++) {
    const { st, k } = queue[q];
    roomRun.cur = queue[q]; roomRun.askedNow = false;
    refreshAsk();
    if (!st.listen) warnMonster();
    const title = `${d.monster.name} · ${RX.step.replace('{n}', roomRun.done + 1).replace('{total}', roomRun.total)}`;
    if (st.type === 'collect') { await stepCollect(st); roomRun.chaseOn = false; monsterHome(r); continue; }
    if (st.type === 'tiles') await stepTiles(st);
    else {
      $('riddle').hidden = true;
      startAttack(attackSeconds(st));
      if (st.type === 'order') await openOrder({ title: st.title, hint: d.goal, items: st.items, poolH: 'القطع المبعثرة', slotsH: 'بالترتيب الصحيح', hint2: d.hint });
      else if (st.type === 'choose') await openQuiz(st, title, st.custom ? 'custom' : listenId(r.room.id, k));
      else if (st.type === 'memory') { stopAttack(); await stepMemory(st, title); }
      stopAttack();
    }
    hitMonster();
    await wait(0.6);
  }
  stopAttack();
  $('fightBar').hidden = true;
  await homeworkGate(r.room.id);
  roomRun.heal = 0;
  setRoomHealth(0);
  await winRoom(r);
}
// النهاية: يصغر الإهمال، تخرج المعلمة، تعود الوحوش بأصواتها إلى الكتاب، وينغلق بقفل «تغلّب على مخاوفك»
async function bossWin(r) {
  const d = r.data, c = roomPos(r.i), m = r.monster, lines = roomWords(d.win, r);
  G.lock++;
  await camTo(new V3(c.x + 1, 3.4, c.z + 3), m.g.position.clone().add(new V3(0, 2, 0)), 0.8);
  SFX.play('growl');
  await say(lines.slice(0, 1));
  SFX.play('magic');
  const s0 = m.scale;
  await tween(1.6, (k) => { m.inner.rotation.y = k * PI * 8; m.scale = s0 + (0.05 - s0) * k; });
  m.g.visible = false; r.monsterCol.on = false;
  burst(m.g.position.clone().add(new V3(0, 1, 0)), 0x7a1fa2, 60, 7);
  // فتح القفص
  SFX.play('door');
  await camTo(new V3(c.x - 4, 2.6, c.z), r.held.position.clone().add(new V3(0, 1.2, 0)), 0.7);
  await tween(0.9, (k) => { r.bars.forEach((b) => { b.position.y = 1.6 - ease(k) * 3.4; }); });
  r.cageCol.on = false;
  burst(r.held.position.clone().add(new V3(0, 1.5, 0)), 0xffe066, 50, 6);
  SFX.play('win');
  await say(lines.slice(1, 2));
  // الكتاب في وسط الغرفة
  const book = new THREE.Group(); book.position.set(c.x, 0, c.z); scene.add(book);
  box(3, 0.4, 2.2, 0x3b1f85, 0, 0.9, 0, book);
  box(2.8, 0.1, 2, 0xfffaf0, 0, 1.15, 0, book);
  const lid = new THREE.Group(); lid.position.set(-1.5, 1.28, 0); book.add(lid);
  box(3, 0.12, 2.2, 0x5a33b8, 1.5, 0, 0, lid);
  lid.rotation.z = 2.2;
  glow(0xffd23f, 7, book).position.y = 1.6;
  r.finalBook = book;
  await camTo(new V3(c.x + 1, 3.6, c.z + 7), new V3(c.x, 1.3, c.z), 1);
  const names = Object.values(RC).map((x) => x.monster.name).concat(C.names.monster || 'قِرطاس');
  const flying = names.map((nm, n) => {
    const l = label(nm, 0.55, { size: 60, border: '#7a1fa2' });
    const a = n / names.length * PI * 2;
    return { l, a, d: n * 0.05 };
  });
  const flight = tween(5, (k) => {
    flying.forEach((f) => {
      const t = Math.max(0, Math.min(1, (k - f.d) / 0.5)), rad = 8 * (1 - t);
      f.l.position.set(c.x + Math.cos(f.a + t * 3) * rad, 1.4 + (1 - t) * 3, c.z + Math.sin(f.a + t * 3) * rad);
      f.l.visible = t < 1;
    });
  });
  [0, 0.8, 1.6, 2.4].forEach((s) => setTimeout(() => { SFX.play('growl'); }, s * 1000));
  await say(lines.slice(2, 3));
  await flight;
  flying.forEach((f) => scene.remove(f.l));
  await tween(1, (k) => { lid.rotation.z = 2.2 * (1 - ease(k)); });
  SFX.play('door');
  const lockSign = label('🔒 تغلّب على مخاوفك', 0.9, { size: 80, border: '#d4a64a' }, book);
  lockSign.position.y = 3;
  burst(new V3(c.x, 2, c.z), 0xffd23f, 70, 7);
  SFX.play('win');
  await say(lines.slice(3));
  await wait(0.8);
  G.cleared.add('mongia');
  setEnergy(100);
  r.held.visible = false; r.mongia.visible = true;
  G.camPitch = 0.1;
  save();
  G.cam = null;
  G.lock--;
  roomRun = null;
  refreshHallDoors();
  showEnd(RX.finalCard);
}
async function winRoom(r) {
  const d = r.data, c = roomPos(r.i), m = r.monster;
  roomRun.active = false;
  $('riddle').hidden = true;
  $('monsterBar').hidden = true;
  if (d.boss) { await bossWin(r); return; }
  G.lock++;
  await camTo(new V3(c.x + 1, 3, c.z + 2), m.g.position.clone().add(new V3(0, 1.2, 0)), 0.8);
  SFX.play('magic');
  const s0 = m.scale;
  await tween(1.4, (k) => { m.inner.rotation.y = k * PI * 6; m.scale = s0 + (0.3 - s0) * k; });
  m.inner.rotation.y = 0;
  befriendMonster(m);
  r.monsterCol.on = false;
  burst(m.g.position.clone().add(new V3(0, 1, 0)), 0xffe066, 50, 6);
  const lines = roomWords(d.win, r);
  if (r.captive) {
    await say(lines.slice(0, 1));
    SFX.play('door');
    await camTo(new V3(c.x - 4, 2.6, c.z), r.cagePos.clone().add(new V3(0, 1.2, 0)), 0.7);
    await tween(0.9, (k) => { r.bars.forEach((b) => { b.position.y = 1.6 - ease(k) * 3.4; }); });
    r.cageCol.on = false;
    burst(r.cagePos.clone().add(new V3(0, 1.5, 0)), 0xffe066, 40, 5);
    r.captive.position.set(r.cagePos.x + 1.8, 0, r.cagePos.z + 1.6);
    SFX.play('win');
    await say(lines.slice(1));
    joinTeam(r.captive, d.captive.name);
    toast(`انضمّ ${d.captive.name} إلى الفريق! 🔑`, 'good', 3000);
  } else {
    SFX.play('win');
    await say(lines);
  }
  G.cleared.add(r.room.id);
  if (r.room.id === 'spelling' && HW.words()) G.wordsDone = HW.words().id;
  setEnergy(G.energy + 30);
  gainSkill(r.room.id, 3, RX.skillWin);
  if (SEARCH_ROOMS.includes(r.room.id) && G.kidnapped) await say(RX.story.notHere);
  G.cam = null;
  G.lock--;
  roomRun = null;
  refreshTip();
}
// حال الغرفة عند الدخول: الوحش مستيقظ، أو صديق صغير إن هُزم، والمحتجز في قفصه
function setupRoom(r) {
  const d = r.data;
  if (r.seats) r.seats.forEach((s) => { s.sp.visible = s.k === 'salem' ? G.stage === 'done' : G.cleared.has(Object.keys(RC).find((id) => RC[id].captive && RC[id].captive.sprite === s.k)); });
  if (!d) return;
  const won = G.cleared.has(r.room.id);
  const m = r.monster;
  if (won) { befriendMonster(m); m.scale = m.target; r.monsterCol.on = false; }
  else { m.happy = false; m.target = m.boss || 1; m.scale = m.boss || 1; m.orbit.forEach((o) => { o.l.visible = true; }); r.monsterCol.on = true; }
  r.tiles.forEach((t) => { t.lb.visible = false; t.on = false; t.mesh.material = mat(0xfff3d6); });
  if (d.boss) {
    r.mongia.visible = won; r.held.visible = !won;
    r.bars.forEach((b) => { b.position.y = won ? -1.8 : 1.6; });
    r.cageCol.on = !won;
    m.g.visible = !won;
  }
  if (r.captive) {
    r.bars.forEach((b) => { b.position.y = won ? -1.8 : 1.6; });
    r.cageCol.on = !won;
    if (!team.some((t) => t.obj === r.captive)) { r.captive.visible = true; r.captive.scale.setScalar(1); r.captive.position.copy(r.cagePos); }
  }
}
// مراحل القصة: ستة زملاء يتحررون، ثم الخطف والبحث في أربع غرف، ثم الكتب والفيتامينات، ثم الإهمال
const STORY_FIRST = ['spelling', 'grammar', 'listening', 'vocab', 'expression'];
const SEARCH_ROOMS = ['homework', 'memory', 'review', 'tests'];
const sixFreed = () => G.stage === 'done' && STORY_FIRST.every((id) => G.cleared.has(id));
const searchDone = () => G.kidnapped && SEARCH_ROOMS.every((id) => G.cleared.has(id));
const newWords = () => { const w = HW.words(); return !!w && G.wordsDone !== w.id; };
function roomState(i) {
  const room = SC.rooms[i];
  if (i === 0) return G.stage === 'done' ? 'done' : 'open';
  if (RC[room.id]) {
    if (G.cleared.has(room.id)) return 'done';
    if (room.id === 'mongia') return (searchDone() && G.vitamins) || ALL_OPEN ? 'open' : 'locked';
    if (SEARCH_ROOMS.includes(room.id)) return G.kidnapped || HW.pending(room.id) || ALL_OPEN ? 'open' : 'locked';   // واجب المعلم يفتح الغرفة لهذا الطالب
    return 'open';   // يبدأ اللاعب بأي من الغرف الأولى
  }
  if (room.theme === 'secret') return allCleared() || ALL_OPEN ? 'open' : 'locked';
  return 'open';
}
// هل هُزمت كل الوحوش؟ (المكتبة وغرف المهارات)
function allCleared() { return G.cleared.has('mongia'); }
function nextRoomName() {
  if (allCleared()) return null;
  const id = RX.order.find((x) => !G.cleared.has(x));
  return id ? SC.rooms.find((x) => x.id === id).name : SC.rooms[0].name;
}
function refreshHallDoors() {
  hall.doors.forEach((d) => {
    const st = roomState(d.i);
    d.lock.visible = st === 'locked';
    d.check.visible = st === 'done';
    d.glow.visible = st === 'open';
  });
}
function updateRoom(dt) {
  const t = G.time;
  for (const r of rooms) {
    if (!r || !r.monster) continue;
    const m = r.monster;
    m.scale += (m.target - m.scale) * Math.min(1, dt * 3);
    m.hurt = Math.max(0, m.hurt - dt); m.laugh = Math.max(0, m.laugh - dt);
    const bob = m.happy ? Math.abs(Math.sin(t * 5)) * 0.35 : Math.sin(t * 2) * 0.15;
    m.inner.scale.setScalar(m.scale * (1 + Math.sin(m.laugh * 20) * 0.06));
    m.inner.position.set(m.hurt ? Math.sin(m.hurt * 50) * 0.15 : 0, bob + (m.happy ? 0 : 0.3), 0);
    if (G.area === 'room' && G.room === r.i) m.g.rotation.y = angleLerp(m.g.rotation.y, Math.atan2(P.pos.x - m.g.position.x, P.pos.z - m.g.position.z), 1 - Math.exp(-dt * 3));
    m.orbit.forEach((o, k) => { o.l.position.set(Math.cos(o.a + t * 1.4) * 2.3 * m.scale, (m.top * 0.55 + Math.sin(t * 2 + k) * 0.4) * m.scale + 0.4, Math.sin(o.a + t * 1.4) * 2.3 * m.scale); });
    m.name.position.y = m.top * m.scale + 0.8;
    m.eyes.forEach((e) => { e.scale.y = m.hurt > 0.2 ? 0.2 : 1; });
    if (m.arms) m.arms.forEach((a, k) => {                  // ذراعان تتأرجحان (وترتفعان عند الضحك أو الغضب)
      a.sh.rotation.z = a.sx * (0.55 + (m.laugh > 0 || m.hurt > 0 ? 0.9 : Math.sin(t * 2.2 + k * PI) * 0.18));
      a.sh.rotation.x = Math.sin(t * 1.7 + k) * 0.25 - (m.happy ? 0.8 : 0);
    });
    if (m.tail) m.tail.rotation.y = Math.sin(t * 2.5) * 0.45;
  }
  if (G.area !== 'room' || !roomRun) return;
  const r = roomRun.r;
  if (roomRun.onTile && G.lock === 0) {
    const tile = r.tiles.find((tt) => tt.on && Math.abs(P.pos.x - tt.x) < 1.5 && Math.abs(P.pos.z - tt.z) < 1.0 && P.pos.y < 0.05);
    if (tile && tile !== roomRun.lastTile) roomRun.onTile(tile);
    roomRun.lastTile = tile || null;
  }
  if (roomRun.attackMax > 0) {
    roomRun.attackLeft -= dt;
    $('attackFill').style.width = Math.max(0, roomRun.attackLeft / roomRun.attackMax * 100) + '%';
    $('attackText').textContent = `⚔️ الوحش يهاجم بعد ${Math.ceil(Math.max(0, roomRun.attackLeft))}`;
    if (roomRun.attackLeft <= 0) {
      roomRun.attackLeft = roomRun.attackMax;
      const m = r.monster;
      m.laugh = 1; SFX.play('boo');
      roomRun.heal = (roomRun.heal || 0) + 5;
      setRoomHealth(roomRun.health + 5);
      hurtHero(10);
      toast('⚔️ هاجمك الوحش واستعاد بعض قوته! أسرع في الجواب', 'bad', 2600);
    }
  }
  if (roomRun.chaseOn && (roomRun.onTile || roomRun.onKey) && G.lock === 0) {
    if (roomRun.chaseWait > 0) {
      roomRun.chaseWait -= dt;
      if (roomRun.chaseWait <= 0) { r.monsterCol.on = false; SFX.play('growl'); warnMonster(); }
    } else {
      const g = r.monster.g, dx = P.pos.x - g.position.x, dz = P.pos.z - g.position.z, d = Math.hypot(dx, dz);
      roomRun.stun = Math.max(0, (roomRun.stun || 0) - dt);
      const sp = roomRun.stun > 0 ? 0 : (1.5 + G.grade * 0.12) * (1 + 0.25 * (roomRun.rage || 0));   // أسرع في الصفوف الأعلى وحين يغضب
      const blocker = roomRun.stun > 0 ? null : team.find((t) => !(roomRun.blocked || []).includes(t.obj) && Math.hypot(t.obj.position.x - g.position.x, t.obj.position.z - g.position.z) < 2.6);
      if (blocker) {
        (roomRun.blocked = roomRun.blocked || []).push(blocker.obj);
        roomRun.stun = 2.5;
        burst(g.position.clone().add(new V3(0, 1.6, 0)), 0x7be3a6, 26, 5);
        toast(`🛡️ ${blocker.name} يعترض الوحش! أسرع!`, 'good', 2400);
      }
      if (d > 0.1) { g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; }
      collide(g.position, 1.0);
      g.position.y = 0;
      if (d < 1.5) roomCaught(12);
    }
  }
  roomRun.keys.forEach((k, n) => {
    if (k.done) return;
    k.g.position.y = 1.2 + Math.sin(t * 2.5 + n) * 0.25;
    k.g.rotation.y = t * 2;
    if (roomRun.onKey && !k.busy && G.lock === 0 && Math.hypot(k.g.position.x - P.pos.x, k.g.position.z - P.pos.z) < 1.2) roomRun.onKey(k);
  });
}

async function enterHall(fromRoom = null) {
  G.lock++;
  G.camPitch = 0.42;
  tip('');
  SFX.play('door');
  await fade(true);
  if (!hall.built) buildHall();
  refreshHallDoors();
  team.forEach((t) => { t.obj.visible = true; });
  setArea('hall');
  if (fromRoom !== null) {
    const d = hall.doors[fromRoom];
    const f = d.front;
    const facing = fromRoom === 12 ? 0 : Math.atan2(HX - f.x, 0);
    placePlayer(f.x, f.z + (fromRoom === 12 ? 2 : 0), fromRoom === 12 ? 0 : facing);
  } else placePlayer(HX, -2.5, PI);
  await fade(false);
  G.lock--;
  refreshTip();
  await storyCheck();
}
async function storyCheck() {
  if (!G.kidnapped && sixFreed()) {
    G.kidnapped = true; save();
    refreshHallDoors();
    SFX.play('growl');
    burst(P.pos.clone().setY(2.4), 0x7a1fa2, 40, 7);
    await say(RX.story.kidnap);
    refreshTip();
  }
  showHallBooks();
  if (searchDone() && !G.searchSaid && !G.vitamins) {
    G.searchSaid = true;
    await say(RX.story.searched);
  }
}
// كتب المهارات والفيتامينات أمام باب غرفة المعلمة
function showHallBooks() {
  if (!hall.built) return;
  const want = searchDone() && !G.vitamins;
  if (want && !hall.books) {
    const f = hall.doors[11].front;
    hall.books = new THREE.Group(); hall.books.position.set(f.x, 0, f.z); scene.add(hall.books);
    SKILLS.forEach((k, n) => {
      const a = n / SKILLS.length * PI * 2;
      const b = box(0.5, 0.14, 0.7, new THREE.Color(k.color).getHex(), Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4, hall.books);
      b.rotation.y = a;
      const l = label(k.icon, 0.5, { bg: null, size: 80, pad: 4 }, hall.books);
      l.position.set(Math.cos(a) * 1.4, 0.75, Math.sin(a) * 1.4);
    });
    label('📚 💊', 0.8, { bg: null, size: 90, pad: 4 }, hall.books).position.y = 1.9;
    glow(0xffd23f, 2.6, hall.books).position.y = 1;
  }
  if (hall.books) hall.books.visible = want;
}
async function takeBooks() {
  G.lock++;
  await say(RX.story.door);
  SFX.play('magic');
  const f = hall.doors[11].front;
  burst(new V3(f.x, 1.2, f.z), 0xffd23f, 50, 6);
  team.forEach((t) => burst(t.obj.position.clone().add(new V3(0, 1.2, 0)), 0x7be3a6, 18, 3));
  burst(P.pos.clone().setY(1.2), 0x7be3a6, 18, 3);
  G.vitamins = true;
  setEnergy(100);
  SKILLS.forEach((k) => { G.skills[k.id] = (G.skills[k.id] || 0) + 1; });
  renderSkills(); save();
  showHallBooks();
  refreshHallDoors();
  toast('📚 💊 أخذ كل طالب كتابًا وفيتامينًا!', 'good', 3200);
  await say(RX.story.taken);
  G.lock--;
  refreshTip();
}
async function enterRoom(i) {
  G.lock++;
  SFX.play('door');
  await fade(true);
  const r = buildRoom(i);
  G.room = i;
  if (SC.rooms[i].id === 'spelling' && newWords()) G.cleared.delete('spelling');
  setupRoom(r);
  setArea('room');
  G.camPitch = SC.rooms[i].theme === 'office' && G.cleared.has('mongia') ? 0.1 : 0.42;
  placePlayer(r.exitFront.x, r.exitFront.z - 3.5, PI);
  await fade(false);
  G.lock--;
  tip(SC.rooms[i].name);
  const T = SC.rooms[i].theme;
  // في الصف يجلس الأصدقاء في مقاعدهم بدل أن يتبعوا اللاعب
  team.forEach((t) => { if (t.obj !== shtshout && t.obj !== shtshouta) t.obj.visible = T !== 'class'; });
  if (r.data && !G.cleared.has(SC.rooms[i].id)) await startRoomFight(r);
  else if (r.data) { toast(RX.roomDone, 'good', 2600); await homeworkGate(SC.rooms[i].id); }
  else if (T === 'class' && !r.seen) { r.seen = true; await say(RX.class); }
  else if (T === 'secret' && !r.seen) {
    r.seen = true;
    G.lock++;
    const c = roomPos(i);
    if (!r.mongiaHere) { r.mongiaHere = charSprite('mongia', 1.7); r.mongiaHere.position.set(c.x + 2.6, 0, c.z - 4.5); (window.extraChars = window.extraChars || []).push(r.mongiaHere); }
    await camTo(new V3(c.x + 2, 3, c.z - 1), new V3(c.x, 1.4, c.z - 6), 1.2);
    SFX.play('magic'); burst(new V3(c.x, 2, c.z - 6), 0xffd23f, 50, 6);
    await say(RX.secret);
    G.cam = null; G.lock--;
  }
}

/* ---------------- بناء العالم ---------------- */
let player, monster, shtshout, shtshouta, friend1;
const team = [];                               // التابعون للاعب
const P = { pos: new V3(0, 0, 13), vy: 0, ground: true, facing: PI, moving: 0, walkT: 0, hidden: false, grace: 0 };
const shadows = [];

function buildWorld() {
  buildYard();
  buildLibrary();
  drawDoorText(0);
  player = makePlayer();
  monster = makeMonster();
  monster.g.visible = false;
  shtshout = charSprite('shtshout', 1.25);
  shtshouta = charSprite('shtshouta', 1.25);
  shtshout.position.set(-1.6, 0, 3); shtshouta.position.set(1.6, 0, 3.2);
  shtshouta.userData.mark = label('!', 0.6, { bg: '#ffc93c', border: '#fff', size: 80, pad: 14 }, shtshouta);
  shtshouta.userData.mark.position.y = 1.85; shtshouta.userData.mark.visible = false;
  friend1 = charSprite('salem', 1.35);   // سالم: الصديق الأول المحتجز في مكتبة القراءة
  friend1.position.set(LX + 9, 0, -27);
  for (let i = 0; i < 6; i++) {
    const f = i === 0 ? friend1 : charSprite(Object.keys(STUDENTS)[i - 1], 1.3);
    yard.friends.push(f);
  }
}
function setArea(a) {
  G.area = a;
  if (a === 'yard') {
    scene.background = new THREE.Color(0xf7c98f);
    scene.fog = new THREE.Fog(0xf7c98f, 50, 130);
    hemi.intensity = 0.72; sun.intensity = 0.62;
    SFX.music('yard');
  } else if (a === 'hall' || a === 'room') {
    scene.background = new THREE.Color(0x2b2238);
    scene.fog = new THREE.Fog(0x2b2238, 40, 110);
    hemi.intensity = 0.8; sun.intensity = 0.45;
    SFX.music('yard');
  } else {
    scene.background = new THREE.Color(0x1b1040);
    scene.fog = new THREE.Fog(0x1b1040, 22, 60);
    hemi.intensity = 0.6; sun.intensity = 0.35;
    SFX.music('library');
  }
  if (a === 'library') $('monsterName').textContent = C.names.monster;
  if (window.LIB_LOOK) LIB_LOOK.area(a);
  if (window.HALL_LOOK) HALL_LOOK.area(a);
  if (window.YARD_LOOK) YARD_LOOK.area(a);
  $('monsterBar').hidden = a === 'room' ? !(roomRun && roomRun.active) : (a !== 'library' || !monster.alive);
  $('hudPages').hidden = !(a === 'library' && G.stage === 'libA');
}
function placePlayer(x, z, facing) {
  P.pos.set(x, 0, z); P.vy = 0; P.facing = facing;
  G.camYaw = facing + PI;
  team.forEach((t, i) => {
    t.obj.position.set(x - Math.sin(facing) * (1.6 + i * 1.4) + (i % 2 ? 0.8 : -0.8), 0, z - Math.cos(facing) * (1.6 + i * 1.4));
  });
  snapCamera();
}
function joinTeam(obj, name) {
  if (team.some((t) => t.obj === obj)) return;
  team.push({ obj, name });
  renderTeam();
}
function renderTeam() {
  $('hudTeam').innerHTML = team.length ? '👥 ' + team.map((t) => `<span>${t.name}</span>`).join('') : '';
}

/* ---------------- الإدخال ---------------- */
const keys = {};
const joy = { x: 0, y: 0, active: false };
let jumpQueued = false, useQueued = false, touchRun = false;
const MOVE = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;   // التلميذ أو المعلم يكتب
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (!$('dialog').hidden && ['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) { userAdvance(); return; }
  if (e.code === 'Space') jumpQueued = true;
  if (e.code === 'KeyE' || e.code === 'Enter') useQueued = true;
  if (e.code === 'KeyH' && roomRun) askFriend();
  if (e.code === 'Escape' && G.playing) togglePause();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// تدوير الكاميرا بالسحب
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  G.camYaw -= (e.clientX - drag.x) * 0.006; drag.x = e.clientX;
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

// عصا التحكم على الهاتف
const stick = $('stick'), knob = $('knob');
stick.addEventListener('pointerdown', (e) => { joy.active = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', (e) => { if (joy.active === e.pointerId) moveStick(e); });
const endStick = () => { joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; };
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const m = Math.hypot(dx, dy), max = r.width / 2 - 20;
  if (m > max) { dx = dx / m * max; dy = dy / m * max; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max; joy.y = -dy / max;
}
$('tJump').addEventListener('pointerdown', (e) => { e.preventDefault(); jumpQueued = true; });
$('tUse').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!$('dialog').hidden) userAdvance(); else useQueued = true; });
$('tRun').addEventListener('pointerdown', (e) => { e.preventDefault(); touchRun = !touchRun; $('tRun').style.background = touchRun ? '#ffc93c' : ''; });

/* ---------------- الحوار ---------------- */
const dlg = { queue: [], res: null, full: '', shown: 0, timer: null };
const SPEAKER = {
  shtshout: { color: '#ff8a3d', img: 'shtshout' },
  shtshouta: { color: '#e84d8a', img: 'shtshouta' },
  mongia: { color: '#5b8bd6', img: 'mongia' },
  monster: { color: '#7b3fe4', face: '👾', bg: '#e9ddff' },
  friend: { color: '#8e5cf7', img: 'salem' },
  narrator: { color: '#2a1f4d', face: '📖', bg: '#fff3d6' },
};
function say(lines) {
  return new Promise((res) => {
    G.lock++;
    dlg.queue = lines.slice(); dlg.res = res;
    preloadVoices(lines);
    $('dialog').hidden = false;
    $('prompt').hidden = true;
    nextLine();
  });
}
function nextLine() {
  const line = dlg.queue.shift();
  if (!line) {
    $('dialog').hidden = true;
    dlg.speaker = null;
    G.lock--;
    const r = dlg.res; dlg.res = null; r && r();
    return;
  }
  const sp = SPEAKER[line.who] || SPEAKER.narrator;
  aimAtSpeaker(line.who);
  $('dlgName').textContent = C.names[line.who] || '';
  $('dlgName').style.background = sp.color;
  const por = $('dlgPortrait');
  por.innerHTML = '';
  if (sp.img) { const im = new Image(); im.src = S[sp.img].src; im.alt = C.names[line.who]; por.appendChild(im); }
  else { const d = document.createElement('div'); d.className = 'ph-face'; d.style.background = sp.bg; d.textContent = sp.face; por.appendChild(d); }
  dlg.full = line.text; dlg.shown = 0; dlg.lineAt = performance.now();
  clearInterval(dlg.timer); clearTimeout(dlg.autoT);
  $('dlgText').textContent = '';
  const src = VOICES[line.id];
  if (src && !SFX.muted) playVoice(src);
  else showText();
}
// من يتكلم الآن؟ أقرب شخصية ظاهرة بهذا الاسم؛ الكاميرا تقترب منها ونسمع صوتها دون كتابة
function speakerObj(who) {
  let list = [];
  if (who === 'shtshout') list = [shtshout];
  else if (who === 'shtshouta') list = [shtshouta];
  else if (who === 'friend') list = yard.friends;
  else if (who === 'mongia') list = (window.extraChars || []).filter((o) => o.userData.key === 'mongia');
  else if (who === 'monster') list = [monster && monster.inner.visible && monster.g, ...rooms.map((r) => r && r.monster && r.monster.g)];
  let best = null, bd = 24;
  for (const o of list) {
    if (!o || !o.visible || !o.parent) continue;
    const p = o.getWorldPosition(new V3());
    const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
const SPEAKER_H = { shtshout: 1.25, shtshouta: 1.25, friend: 1.3, mongia: 1.7 };
function aimAtSpeaker(who) {
  const o = speakerObj(who);
  dlg.speaker = o;
  if (!o) return;
  const room = who === 'monster' && rooms.find((r) => r && r.monster && r.monster.g === o);
  dlg.spH = o.userData.speakerH || (room ? room.monster.top * room.monster.scale : who === 'monster' ? 3.2 * o.scale.y : SPEAKER_H[who] || 1.4);
  const p = o.getWorldPosition(new V3());
  const dir = camera.position.clone().sub(p); dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dlg.spDir = dir.normalize();
}
function speakerCam() {
  const o = dlg.speaker, h = dlg.spH;
  const p = o.getWorldPosition(new V3());
  const head = p.clone().add(new V3(0, h * 0.82, 0));
  const pos = head.clone().addScaledVector(dlg.spDir, h * 1.15 + 0.6).add(new V3(0, h * 0.1, 0));
  if (o.userData.glb && !o.userData.seated) o.rotation.y = angleLerp(o.rotation.y, Math.atan2(dlg.spDir.x, dlg.spDir.z), 0.15);   // تلتفت إلى الكاميرا وهي تتكلم
  return { pos, look: head, speed: 4 };
}
// الحوار مسموع: الصوت بدل الكتابة، ويتقدّم وحده حين ينتهي الصوت
function playVoice(src) {
  $('dialog').classList.add('voiced');
  const a = voice;
  a.onended = () => { $('dlgWave').classList.remove('on'); dlg.autoT = setTimeout(() => { if (!$('dialog').hidden) nextLine(); }, 700); };
  // لا نُظهر الكتابة إذا تأخر الصوت: نعيد المحاولة (الشبكة البطيئة)، أو ننتظر لمسة التلميذ (منع التشغيل التلقائي)
  let tries = 0;
  const retry = (e) => {
    if ($('dialog').hidden || a.src.indexOf(src) < 0) return;
    if (e && e.name === 'NotAllowedError') { waitTap(() => a.play().catch(retry)); return; }
    if (++tries <= 4) setTimeout(() => { a.load(); a.play().catch(retry); }, 1200 * tries);
    else showText();
  };
  a.onerror = () => retry();
  a.src = src; a.currentTime = 0;
  $('dlgWave').classList.add('on');
  a.play().catch(retry);
}
function waitTap(fn) {
  // هذه اللمسة تشغّل الصوت فقط، ولا تتخطى الجملة
  const go = (e) => { e.stopPropagation(); removeEventListener('click', go, true); removeEventListener('keydown', go, true); fn(); };
  addEventListener('click', go, true); addEventListener('keydown', go, true);
}
// نبدأ تحميل أصوات المشهد كله مبكرًا، فلا ينتظر التلميذ كل جملة على حدة
function preloadVoices(lines) {
  lines.forEach((l) => { const s = VOICES[l.id]; if (s && !preloadVoices.done[s]) { preloadVoices.done[s] = 1; fetch(s).catch(() => {}); } });
}
preloadVoices.done = {};
// احتياط إذا تعذّر الصوت أو كان مكتومًا: يظهر النص مكتوبًا
function showText() {
  voice.pause();
  $('dialog').classList.remove('voiced');
  $('dlgWave').classList.remove('on');
  dlg.timer = setInterval(() => {
    dlg.shown += 2;
    $('dlgText').textContent = dlg.full.slice(0, dlg.shown);
    if (dlg.shown >= dlg.full.length) clearInterval(dlg.timer);
  }, 28);
}
// ضغطة عابرة (مثل E التي فتحت الباب) لا تقطع الجملة في أول ثانيتين
function userAdvance() {
  if ($('dialog').classList.contains('voiced') && performance.now() - (dlg.lineAt || 0) < 2000) return;
  advanceDialog();
}
function advanceDialog() {
  if ($('dialog').hidden) return;
  if ($('dialog').classList.contains('voiced')) { voice.pause(); nextLine(); return; }
  if (dlg.shown < dlg.full.length) { dlg.shown = dlg.full.length; $('dlgText').textContent = dlg.full; clearInterval(dlg.timer); return; }
  nextLine();
}
const voice = new Audio();
const VOICES = window.VOICES || {};
$('dialog').addEventListener('click', userAdvance);
$('dlgReplay').addEventListener('click', (e) => {
  e.stopPropagation();
  clearTimeout(dlg.autoT);
  voice.currentTime = 0; $('dlgWave').classList.add('on');
  voice.play().catch(() => showText());
});
// كل جملة حوار تأخذ معرّفًا من موضعها في ملف المحتوى (intro-0، story-done-1...) يطابق اسم ملف صوتها
function tagLines(x, p) {
  if (Array.isArray(x)) x.forEach((y, i) => tagLines(y, p + '-' + i));
  else if (x && typeof x === 'object') {
    if (x.who && x.text) x.id = p;
    else for (const k in x) tagLines(x[k], p ? p + '-' + k : k);
  }
}
tagLines(C, '');
tagLines(RC, 'rooms');
tagLines(RX, 'roomsx');
for (const k in STUDENTS) SPEAKER[k] = { color: '#2bb673', img: k };

/* ---------------- رسائل الواجهة ---------------- */
let toastT = null;
function toast(text, kind = 'good', ms = 1800) {
  const t = $('toast');
  t.textContent = withKeys(text); t.className = 'on ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, ms);
}
// التعليمات تذكر الزر المطلوب: على الحاسوب المفتاح، وعلى الهاتف زر الشاشة
const withKeys = (text) => { const t = String(text || '').replace(/اقفز/, isTouch ? 'اقفز (اضغط زر «قفز»)' : 'اقفز (اضغط مفتاح المسافة)'); return isTouch ? t.replace(/اضغط E/, 'اضغط زر «تفاعل»').replace(/بالأسهم أو WASD/, 'بعصا التحكم') : t; };
function tip(text) { $('tip').textContent = withKeys(text); }
function setHealth(h) {
  G.health = Math.max(0, h);
  $('monsterFill').style.width = G.health + '%';
  const s = 0.75 + 0.85 * G.health / 100;    // الوحش يصغر كلما ضعُف
  monster.targetScale = s;
}
function updateHud() {
  $('hudStars').querySelector('b').textContent = skillPoints();
  $('hudPower').querySelector('b').textContent = powerLevel();
  $('hudEnergy').querySelector('b').textContent = Math.round(G.energy);
  $('hudEnergy').classList.toggle('low', G.energy < 40);
  $('hudPages').querySelector('b').textContent = G.pages;
}

/* ---------------- تحدي ترتيب الصفحات ---------------- */
function openOrder(o = {}) {
  return new Promise((resolve) => {
    G.lock++;
    const panel = $('order'), pool = $('orderPool'), slots = $('orderSlots'), fb = $('orderFb');
    $('orderTitle').textContent = o.title || C.story.title;
    $('orderHint').textContent = o.hint || C.story.hint;
    $('orderPoolH').textContent = o.poolH || 'الصفحات المبعثرة';
    $('orderSlotsH').textContent = o.slotsH || 'القصة بالترتيب';
    const pages = o.items || C.story.pages;
    panel.classList.toggle('short', !!o.items);
    let order = pages.map((_, i) => i);
    do shuffle(order); while (order.every((v, i) => v === i));
    const placed = new Array(pages.length).fill(null);
    const locked = new Array(pages.length).fill(false);
    let tries = 0;
    const card = (i, cls = '') => {
      const b = document.createElement('button');
      b.className = 'page-card ' + cls; b.textContent = pages[i]; b.dataset.i = i;
      return b;
    };
    function render() {
      pool.innerHTML = ''; slots.innerHTML = '';
      order.filter((i) => !placed.includes(i)).forEach((i) => {
        const b = card(i);
        b.onclick = () => { const k = placed.indexOf(null); if (k >= 0) { placed[k] = i; SFX.play('page'); render(); } };
        pool.appendChild(b);
      });
      placed.forEach((i, k) => {
        const li = document.createElement('li');
        if (i === null) { const e = document.createElement('div'); e.className = 'empty'; li.appendChild(e); }
        else {
          const b = card(i, locked[k] ? 'ok' : '');
          b.onclick = () => { if (!locked[k]) { placed[k] = null; render(); } };
          li.appendChild(b);
        }
        slots.appendChild(li);
      });
    }
    $('orderReset').onclick = () => { placed.forEach((_, k) => { if (!locked[k]) placed[k] = null; }); fb.textContent = ''; render(); };
    $('orderCheck').onclick = () => {
      if (placed.includes(null)) { fb.textContent = o.items ? 'ضع كل القطع أولًا.' : 'ضع كل الصفحات أولًا.'; fb.style.color = '#ff6b6b'; return; }
      tries++;
      let wrong = 0;
      placed.forEach((i, k) => { if (i === k || (o.items && o.items[i] === o.items[k])) locked[k] = true; else wrong++; });
      render();
      if (!wrong) {
        fb.textContent = 'أحسنت! القصة مرتّبة. 🎉'; fb.style.color = '#2bb673';
        SFX.play('good');
        setTimeout(() => { panel.hidden = true; G.lock--; resolve(tries); }, 1300);
        return;
      }
      hurtHero(); SFX.play('bad');
      slots.querySelectorAll('li').forEach((li, k) => { if (!locked[k]) li.querySelector('.page-card')?.classList.add('no'); });
      fb.style.color = '#ff6b6b';
      fb.textContent = tries > 1
        ? (o.items ? 'القطع الخضراء في مكانها. ' + (o.hint2 || 'فكّر: ماذا يأتي بعد آخر قطعة صحيحة؟') : 'الصفحات الخضراء في مكانها. اقرأ آخر صفحة صحيحة، وابحث عمّا حدث بعدها.')
        : (o.items ? `${wrong} قطع ليست في مكانها. الخضراء صحيحة.` : `${wrong} صفحات ليست في مكانها. الخضراء صحيحة، أعد قراءة الباقي.`);
      setTimeout(() => { placed.forEach((_, k) => { if (!locked[k]) placed[k] = null; }); render(); }, 1100);
    };
    fb.textContent = '';
    render();
    panel.hidden = false;
  });
}

/* ---------------- مراحل القصة ---------------- */
const STAGE_TIPS = {
  yard: () => C.tips.yard, yard2: () => C.tips.toLibrary,
  libA: () => G.pages < 5 ? C.tips.pages : C.tips.lectern,
  libB: () => C.tips.bridge, libC: () => C.tips.spell, rescued: () => C.tips.exit,
  done: () => (allCleared() ? RX.tipAll : searchDone() ? (G.vitamins ? RX.tipBoss : RX.tipBooks) : G.kidnapped ? RX.tipSearch : RX.tipNext),
};
function refreshTip() { tip(P.hidden && G.stage === 'libA' ? C.tips.hide : (STAGE_TIPS[G.stage] || (() => ''))()); }

async function playIntro() {
  G.lock++;
  setArea('yard');
  yard.friends.forEach((f, i) => {
    const a = PI * 0.15 + i / 5 * PI * 0.7;
    f.position.set(Math.cos(a) * 4.2, 0, 1 - Math.sin(a) * 3.2);
    f.visible = true; f.scale.setScalar(1);
  });
  shtshout.position.set(-1.2, 0, 2.6); shtshouta.position.set(1.4, 0, 2.9);
  player.g.visible = false;
  G.cam = { pos: new V3(0, 3, 10), look: new V3(0, 1.2, 1), speed: 6 };
  snapCamera();
  await fade(false);
  await camTo(new V3(0.5, 2.1, 6.5), new V3(0, 1.1, 1.5), 1.5);
  await say(C.intro.slice(0, 5));
  // يفتح شتشوت الكتاب
  SFX.play('door');
  await tween(0.6, (k) => { yard.bookLid.rotation.z = ease(k) * 2.6; });
  SFX.play('magic');
  burst(new V3(0, 1.3, 1), 0xb388ff, 40, 6, 0.5);
  $('fade').classList.add('on'); await wait(0.15); $('fade').classList.remove('on');
  G.cam = { pos: new V3(0, 6, 15), look: new V3(0, 2, -10), speed: 2 };
  // ستة وحوش صغيرة تخطف ستة أصدقاء إلى غرفهم
  SFX.play('growl');
  const fly = C.rooms.map((room, i) => {
    const color = new THREE.Color(room.color).getHex();
    const sm = makeShadowMonster(color);
    sm.position.set(0, 1.3, 1);
    shadows.push(sm);
    const f = yard.friends[i];
    const from = sm.position.clone(), fFrom = f.position.clone();
    const to = doorPos(i).clone().add(new V3(0, 2.5, i === 5 ? 0 : 1.2));
    return (async () => {
      await wait(i * 0.18);
      await tween(0.5, (k) => { sm.position.lerpVectors(from, fFrom.clone().add(new V3(0, 1.6, 0)), ease(k)); });
      SFX.play('boo');
      const ff = f.position.clone();
      await tween(1.6, (k) => {
        const e = ease(k);
        sm.position.lerpVectors(fFrom.clone().add(new V3(0, 1.6, 0)), to, e); sm.position.y += Math.sin(e * PI) * 4;
        f.position.lerpVectors(ff, to.clone().add(new V3(0, -1.6, 0)), e); f.position.y += Math.sin(e * PI) * 4;
        f.scale.setScalar(1 - e * 0.9);
      });
      sm.visible = false; f.visible = false;
      burst(to, color, 14, 3);
    })();
  });
  await Promise.all(fly);
  await camTo(new V3(-0.5, 2.0, 6.2), new V3(0, 1.1, 2), 1.2);
  await say(C.intro.slice(5));
  await fade(true);
  shadows.forEach((s) => scene.remove(s));
  shtshout.position.set(-2.2, 0, 5.6); shtshouta.position.set(-0.6, 0, 6.4);
  shtshouta.userData.mark.visible = true;
  player.g.visible = true;
  placePlayer(0, 21, PI);
  G.cam = null;
  G.stage = 'yard'; save();
  await fade(false);
  G.lock--;
  refreshTip();
  toast('تحرّك بالأسهم أو WASD', 'good', 2600);
}

async function talkShtshouta() {
  shtshouta.userData.mark.visible = false;
  await say(C.yardTalk);
  joinTeam(shtshouta, C.names.shtshouta);
  joinTeam(shtshout, C.names.shtshout);
  G.stage = 'yard2'; save();
  yard.doors[0].arrow.visible = true;
  refreshTip();
  toast('انضمّ شتشوت وشتشوتة إلى الفريق!', 'good');
  SFX.play('good');
}

async function enterLibrary() {
  G.lock++;
  if (window.LIB_LOOK) await LIB_LOOK.intro();
  tip('');
  yard.doors[0].arrow.visible = false;
  SFX.play('door');
  await fade(true, true);
  setupLibrary('libA');
  setArea('library');
  placePlayer(LX, 6.5, PI);
  monster.g.visible = true;
  monster.g.position.set(LX, 0, -3);
  monster.inner.scale.setScalar(0.01);
  G.cam = { pos: new V3(LX + 2.5, 2.4, 9.5), look: new V3(LX, 1.5, 0), speed: 4 };
  snapCamera();
  await fade(false);
  SFX.play('growl');
  await tween(0.9, (k) => { monster.inner.scale.setScalar(0.01 + ease(k) * 1); });
  burst(new V3(LX, 2, -3), 0xb388ff, 30, 5);
  await camTo(new V3(LX + 3, 3, 3), new V3(LX, 2, -3), 0.9);
  await say(C.libraryEnter.slice(0, 2));
  await camTo(new V3(LX + 2, 5, -10), new V3(LX + 9, 1.5, -27), 1.6);   // الصديق في القفص خلف الهاوية
  await wait(0.6);
  await camTo(new V3(LX - 1.5, 2.5, 13), new V3(LX, 1.4, 6), 1);
  await say(C.libraryEnter.slice(2));
  G.cam = null;
  G.stage = 'libA'; save();
  setArea('library');
  monster.state = 'patrol'; monster.calm = 3.5; monster.wp = 1;
  G.lock--;
  refreshTip();
}

function setupLibrary(stage) {
  monster.alive = true;
  monster.g.visible = true;
  monster.book && (monster.book.visible = false);
  monster.inner.visible = true;
  monster.letters.forEach((l) => { l.l.visible = true; });
  monster.name.visible = true;
  const after = (s) => ['libA', 'libB', 'libC', 'rescued'].indexOf(stage) > ['libA', 'libB', 'libC', 'rescued'].indexOf(s);
  G.pages = after('libA') ? 5 : 0;
  lib.pages.forEach((p) => { p.taken = after('libA'); p.obj.visible = !p.taken; });
  G.round = 0;
  const bridgeDone = after('libB');
  lib.bridge.forEach((b) => { b.visible = bridgeDone; b.position.y = -0.1; });
  lib.gapCol.on = !bridgeDone;
  lib.sideCols.forEach((c) => { c.on = bridgeDone; });
  lib.tiles.forEach((t) => { t.lb.visible = false; t.mesh.material = mat(0xd6c9ff); });
  lib.board.visible = false;
  G.spellIdx = 0;
  lib.books.forEach((b) => { b.done = false; b.obj.visible = false; b.obj.position.copy(b.base); b.obj.scale.setScalar(1); });
  drawDoorText(stage === 'rescued' ? C.spell.words.length : 0);
  lib.bars.forEach((b) => { b.position.y = 1.6; });
  lib.exitGlow.visible = false;
  lib.doorLeaf.visible = true;
  friend1.visible = true; friend1.scale.setScalar(1);
  if (!team.some((t) => t.obj === friend1)) friend1.position.set(LX + 9, 0, -27);
  if (stage === 'libA') { setHealth(100); monster.g.position.set(LX, 0, -5); monster.state = 'patrol'; monster.calm = 3.5; }
  if (stage === 'libB') { setHealth(66); monster.g.position.set(LX + 5, 2.6, -17); monster.state = 'float'; startBridgeRound(); }
  if (stage === 'libC') { setHealth(33); monster.state = 'circle'; showBooks(); }
  if (stage === 'rescued') {
    setHealth(0); defeatMonsterInstant();
    lib.bars.forEach((b) => { b.position.y = -1.6; });
    joinTeam(friend1, C.names.friend);
    openExit();
  }
  monster.g.scale.setScalar(1);
  monster.inner.scale.setScalar(monster.targetScale || 1.6);
  $('riddle').hidden = !(stage === 'libB' || stage === 'libC');
  if (stage === 'libC') updateSpellHud();
}

async function solveStory() {
  if (G.busy) return; G.busy = true;
  monster.state = 'stunned';
  await openOrder();
  setHealth(66);
  gainSkill('reading');
  SFX.play('hit');
  burst(monster.g.position.clone().add(new V3(0, 2, 0)), 0xff6b6b, 30, 5);
  lib.lecternGlow.visible = false;
  G.lock++;
  await camTo(new V3(LX + 4, 3, 2), monster.g.position.clone().add(new V3(0, 1.5, 0)), 0.8);
  await say(C.story.done.slice(0, 1));
  // الوحش يهرب إلى ما وراء الهاوية
  const from = monster.g.position.clone(), to = new V3(LX + 5, 2.6, -17);
  SFX.play('growl');
  G.cam = { pos: new V3(LX - 3, 5, 0), look: new V3(LX + 2, 1.5, -12), speed: 3 };
  await tween(1.4, (k) => { monster.g.position.lerpVectors(from, to, ease(k)); monster.g.position.y += Math.sin(k * PI) * 3; });
  monster.state = 'float';
  await say(C.story.done.slice(1));
  $('hudPages').hidden = true;
  G.stage = 'libB'; save();
  G.cam = null;
  await say(C.wordBridge.intro);
  G.lock--;
  G.round = 0;
  startBridgeRound();
  refreshTip();
  G.busy = false;
}

function startBridgeRound() {
  const r = C.wordBridge.rounds[G.round];
  G.wrongTiles = 0;
  lib.tiles.forEach((t, i) => {
    t.word = r.options[i];
    setLabel(t.lb, r.options[i]);
    t.lb.visible = true;
    t.mesh.material = mat(0xd6c9ff);
  });
  setLabel(lib.board, `اللغز ${G.round + 1}: ${r.clue}`);
  lib.board.visible = true;
  setRiddle(`جسر الكلمات · لغز ${G.round + 1} من ${C.wordBridge.rounds.length}`, r.clue);
  $('riddle').hidden = false;
  lastTile = null;
}
let lastTile = null;
async function stepTile(t) {
  const r = C.wordBridge.rounds[G.round];
  if (t.word === r.answer) {
    G.busy = true;
    SFX.play('good');
    t.mesh.material = mat(0x7be3a6);
    toast(`صحيح! «${r.answer}»`, 'good');
    const seg = lib.bridge[G.round];
    seg.visible = true;
    seg.scale.set(0.01, 1, 1);
    burst(seg.position.clone().add(new V3(0, 0.3, 0)), 0xffe066, 20, 4);
    tween(0.5, (k) => { seg.scale.x = 0.01 + ease(k) * 0.99; });
    setHealth(66 - (G.round + 1) * 8.25);
    gainSkill('reading');
    monster.hurt = 0.6; SFX.play('hit');
    G.round++;
    await wait(1.1);
    if (G.round >= C.wordBridge.rounds.length) await finishBridge();
    else startBridgeRound();
    G.busy = false;
  } else {
    G.wrongTiles++;
    hurtHero(); SFX.play('bad');
    t.mesh.material = mat(0xffb3b3);
    const base = t.mesh.position.y;
    tween(0.5, (k) => { t.mesh.position.y = base - Math.sin(k * PI) * 0.25; });
    const hint = G.wrongTiles >= 2 ? ` تبدأ الكلمة بحرف «${[...r.answer][0]}».` : '';
    toast(`«${t.word}» ليست الجواب. ${C.wordBridge.wrong}${hint}`, 'bad', 3200);
    monster.laugh = 0.8;
    setTimeout(() => { if (t.word !== r.answer) t.mesh.material = mat(0xd6c9ff); }, 900);
  }
}
async function finishBridge() {
  G.lock++;
  lib.tiles.forEach((t) => { t.lb.visible = false; });
  lib.board.visible = false;
  $('riddle').hidden = true;
  lib.gapCol.on = false;
  lib.sideCols.forEach((c) => { c.on = true; });
  SFX.play('magic');
  await camTo(new V3(LX - 4, 4, -3), new V3(LX + 3, 1.5, -15), 1);
  await say(C.wordBridge.done);
  G.stage = 'libC'; save();
  // عرض جملة باب النجاة
  await camTo(new V3(LX, 3.6, -24), new V3(LX, 3.3, -32), 1.4);
  lib.doorText.scale.setScalar(1.08);
  await say(C.spell.intro);
  lib.doorText.scale.setScalar(1);
  G.cam = null;
  monster.state = 'circle';
  showBooks();
  updateSpellHud();
  $('riddle').hidden = false;
  G.lock--;
  refreshTip();
}
function showBooks() {
  lib.books.forEach((b) => {
    b.obj.visible = !b.done; b.obj.scale.setScalar(0.01);
    tween(0.5, (k) => { if (!b.done) b.obj.scale.setScalar(0.01 + ease(k) * 0.99); });
  });
}
function updateSpellHud() {
  const w = C.spell.words;
  $('riddle').innerHTML = `<small>${C.spell.title} · اقرأ الجملة على الباب</small>` +
    w.map((x, i) => i < G.spellIdx ? `<span style="color:#2bb673">${x}</span>` : '<span style="opacity:.35">ـــــ</span>').join(' ');
}
async function touchBook(b) {
  if (b.cool > 0 || b.done) return;
  if (b.idx === G.spellIdx) {
    b.done = true;
    SFX.play('good');
    burst(b.obj.position.clone(), 0xffe066, 22, 4);
    const from = b.obj.position.clone(), to = new V3(LX, 3.4, -31.4);
    tween(0.8, (k) => { b.obj.position.lerpVectors(from, to, ease(k)); b.obj.scale.setScalar(1 - k * 0.8); }).then(() => { b.obj.visible = false; });
    G.spellIdx++;
    drawDoorText(G.spellIdx);
    updateSpellHud();
    setHealth(33 - G.spellIdx * 6.6);
    monster.hurt = 0.6; SFX.play('hit');
    toast(`«${b.word}» ✔`, 'good', 1200);
    if (G.spellIdx >= C.spell.words.length) { G.busy = true; await wait(0.9); await finishSpell(); G.busy = false; }
  } else {
    b.cool = 1.5;
    hurtHero(); SFX.play('bad');
    const known = b.idx >= 0 ? 'هذه كلمة من الجملة، لكن ليس دورها الآن. ابحث عن الكلمة التالية.' : C.spell.wrong;
    toast(`«${b.word}»: ${known}`, 'bad', 3200);
    monster.laugh = 0.8;
    const away = b.obj.position.clone().sub(P.pos).setY(0).normalize().multiplyScalar(1.2);
    const from = b.obj.position.clone();
    tween(0.4, (k) => { b.obj.position.copy(from).addScaledVector(away, Math.sin(k * PI)); });
  }
}
function defeatMonsterInstant() {
  monster.alive = false;
  monster.state = 'defeated';
  monster.inner.visible = false;
  monster.letters.forEach((l) => { l.l.visible = false; });
  monster.name.visible = false;
  if (!monster.book) {
    monster.book = new THREE.Group();
    box(0.9, 0.22, 0.7, 0x7b3fe4, 0, 0.11, 0, monster.book);
    box(0.84, 0.18, 0.66, 0xfffaf0, 0.03, 0.11, 0, monster.book);
    for (const s of [1, -1]) { const e = sphere(0.09, 0xffffff, s * 0.17, 0.26, 0.3, monster.book, 8); sphere(0.045, 0x000000, 0, 0, 0.06, e, 6); }
    label('قِرطاس الصغير 💤', 0.35, { size: 44 }, monster.book).position.y = 0.9;
    scene.add(monster.book);
  }
  monster.book.visible = true;
  monster.book.position.set(LX - 4, 0, -25);
  $('monsterBar').hidden = true;
}
async function finishSpell() {
  await homeworkGate('library');
  G.lock++;
  $('riddle').hidden = true;
  await camTo(new V3(LX - 4, 3.5, -16), monster.g.position.clone().add(new V3(0, 1, 0)), 0.8);
  await say(C.spell.done.slice(0, 1));
  SFX.play('magic');
  const from = monster.g.position.clone(), to = new V3(LX - 4, 0, -25);
  await tween(1.6, (k) => {
    monster.inner.rotation.y = k * PI * 6;
    monster.inner.scale.setScalar((1 - k) * (monster.targetScale || 1) + 0.05);
    monster.g.position.lerpVectors(from, to, ease(k));
  });
  burst(to.clone().add(new V3(0, 0.6, 0)), 0xb388ff, 50, 6);
  defeatMonsterInstant();
  monster.g.position.copy(to);
  await say(C.spell.done.slice(1));
  // يفتح القفص
  SFX.play('door');
  await camTo(new V3(LX + 5, 2.4, -21), new V3(LX + 9, 1.2, -27), 0.8);
  await tween(0.9, (k) => { lib.bars.forEach((b) => { b.position.y = 1.6 - ease(k) * 3.2; }); });
  burst(new V3(LX + 9, 1.5, -27), 0xffe066, 40, 5);
  friend1.position.set(LX + 9, 0, -25.2);
  SFX.play('win');
  await say(C.rescue);
  joinTeam(friend1, C.names.friend);
  toast('انضمّ سالم إلى الفريق! 🔑 مفتاح القراءة', 'good', 3000);
  openExit();
  G.stage = 'rescued';
  setEnergy(G.energy + 30);
  gainSkill('reading', 3, RX.skillWin);
  G.cam = null;
  G.lock--;
  refreshTip();
}
function openExit() {
  lib.doorLeaf.visible = false;
  lib.exitGlow.visible = true;
}

async function exitLibrary() {
  tip('');
  if (G.busy) return; G.busy = true;
  G.lock++;
  SFX.play('door');
  await fade(true);
  setArea('yard');
  monster.g.visible = false;
  if (monster.book) monster.book.visible = false;
  $('riddle').hidden = true;
  placePlayer(0, -18.5, PI);
  yard.doors[0].arrow.visible = false;
  yard.doors[0].leaf.material = mat(0x7be3a6);
  yard.doors[0].glow.visible = false;
  tip('');
  // باب الغرفة الثانية يرتجف وتهرب منه الحروف
  const d2 = yard.doors[1];
  G.cam = { pos: new V3(4, 3, -14), look: new V3(11, 2.5, -24), speed: 3 };
  snapCamera();
  await fade(false);
  const escapees = [];
  'ح ر و ف ه ا ر ب ة'.split(' ').forEach((ch, i) => {
    const l = label(ch, 0.7, { bg: null, color: '#ffe066', stroke: '#ff7a59', size: 90, pad: 8 });
    l.position.set(11, 2.4, -23.4); escapees.push({ l, a: Math.random() * PI * 2, d: i * 0.12 });
  });
  SFX.play('growl');
  const shake = tween(2.4, (k) => {
    d2.grp.rotation.z = Math.sin(k * 60) * 0.03;
    escapees.forEach((e) => {
      const kk = Math.max(0, k - e.d);
      e.l.position.set(11 + Math.cos(e.a) * kk * 6, 2.4 + Math.sin(kk * PI) * 3, -23.4 + kk * 5 + Math.sin(e.a) * kk * 2);
    });
  });
  if (!yard.mongia) { yard.mongia = charSprite('mongia', 1.7); (window.extraChars = window.extraChars || []).push(yard.mongia); }
  yard.mongia.position.set(2.8, 0, -15.5);
  yard.mongia.visible = true;
  await say(C.ending.slice(0, 2));
  await shake;
  d2.grp.rotation.z = 0;
  await say(C.ending.slice(2));
  yard.mongia.visible = false;
  escapees.forEach((e) => scene.remove(e.l));
  G.stage = 'done'; save();
  SFX.play('win');
  showEnd(allCleared() ? RX.finalCard : C.endCard);
  G.cam = null;
  G.lock--;
  G.busy = false;
}
function showEnd(card = C.endCard) {
  G.playing = false;
  $('hud').classList.add('hidden'); $('touch').hidden = true;
  $('endTitle').textContent = card.title;
  $('endLine').textContent = card.line;
  $('endNext').textContent = card.next;
  $('endStats').textContent = `نقاط مهاراتك: ${skillPoints()} · مستوى بطلك: ${powerLevel()} · الفريق: ${team.map((t) => t.name).join('، ')}`;
  const cast = $('endCast');
  cast.innerHTML = '';
  const keys = ['shtshout', 'shtshouta', 'salem', ...Object.keys(STUDENTS).filter((k) => team.some((t) => t.obj === yard.friends[1 + Object.keys(STUDENTS).indexOf(k)])), 'mongia'];
  for (const k of keys) { const im = new Image(); im.src = S[k].src; im.alt = C.names[k] || ''; cast.appendChild(im); }
  $('end').hidden = false;
}
// بعد شاشة النهاية: العودة إلى الممر لمتابعة الغرف
$('btnEndGo').onclick = async () => {
  $('end').hidden = true;
  startPlaying();
  await enterHall();
};

/* ---------------- التفاعل ---------------- */
const interactables = [
  { at: () => shtshouta.position, r: 2.4, label: 'تحدّث إلى شتشوتة', on: () => G.stage === 'yard' && G.area === 'yard', act: talkShtshouta },
  { at: () => yard.doors[0].pos, r: 4.2, label: 'ادخل المدرسة', on: () => (G.stage === 'yard2' || G.stage === 'done') && G.area === 'yard', act: () => enterHall() },
  { at: () => hall.backFront, r: 2.6, label: 'اخرج إلى الساحة', on: () => G.area === 'hall', act: exitToYard },
  { at: () => rooms[G.room] && rooms[G.room].exitFront, r: 2.4, label: 'ارجع إلى الممر', on: () => G.area === 'room' && !(roomRun && roomRun.active), act: () => enterHall(G.room) },
  { at: () => rooms[G.room] && rooms[G.room].exitFront, r: 2.4, label: 'الباب مقفل حتى تهزم الوحش', on: () => G.area === 'room' && !!(roomRun && roomRun.active), act: async () => toast('لا تقلق! الخطأ لا يعاقبك. أكمل التحدي لتهزم الوحش.', 'bad', 2600) },
  { at: () => rooms[11] && (rooms[11].talkAt || rooms[11].mongia.position), r: 3.4, label: 'تحدّث إلى ماما منجية', on: () => G.area === 'room' && G.room === 11 && G.cleared.has('mongia'), act: () => say(RX.mongiaAfter) },
  { at: () => yard.doors[0].pos, r: 4.2, label: 'تحدّث إلى شتشوتة أولًا', on: () => G.stage === 'yard' && G.area === 'yard', act: async () => toast('شتشوتة تريد أن تخبرك شيئًا أولًا', 'bad') },
  { at: () => lib.lectern.position, r: 2.4, label: 'رتّب صفحات القصة', on: () => G.stage === 'libA' && G.pages >= 5 && G.area === 'library', act: solveStory },
  { at: () => lib.lectern.position, r: 2.4, label: 'منصة القراءة: اجمع الصفحات أولًا', on: () => G.stage === 'libA' && G.pages < 5 && G.area === 'library', act: async () => toast(`ما زالت ${5 - G.pages} صفحات مبعثرة`, 'bad') },
  { at: () => new V3(LX, 0, -30.5), r: 3, label: 'اخرج من باب النجاة', on: () => G.stage === 'rescued' && G.area === 'library', act: exitLibrary },
];
interactables.push({ at: () => hall.doors && hall.doors[11] && hall.doors[11].front, r: 3.4, label: 'خذوا الكتب والفيتامينات', on: () => G.area === 'hall' && searchDone() && !G.vitamins, act: takeBooks });
// أبواب الممر الثلاثة عشر
for (let i = 0; i < 13; i++) {
  interactables.push({
    at: () => hall.doors[i] && hall.doors[i].front, r: 2.3,
    get label() {
      const st = roomState(i), nm = SC.rooms[i].name;
      const hw = HW.pending(SC.rooms[i].id) ? ' 📝 فيها واجب' : SC.rooms[i].id === 'spelling' && newWords() ? ' 📝 كلمات جديدة' : '';
      return st === 'locked' ? `🔒 ${nm}` : st === 'done' ? `${nm} ✅${hw}` : `ادخل ${nm}${hw}`;
    },
    on: () => G.area === 'hall',
    act: async () => {
      const st = roomState(i);
      if (st === 'locked') {
        if (SC.rooms[i].theme === 'secret') { toast(RX.secretLocked, 'bad', 2800); return; }
        if (SC.rooms[i].id === 'mongia') {
          if (!G.kidnapped) toast('باب غرفة الأستاذة منجية مغلق الآن.', 'bad', 2800);
          else if (!searchDone()) await say(RX.story.locked);
          else toast(RX.tipBooks, 'bad', 2800);
          return;
        }
        toast('هذه الغرفة مغلقة الآن. حرّروا زملاءكم الستة أولًا.', 'bad', 2800); return;
      }
      if (i === 0) { if (G.stage === 'done') { toast('المكتبة هادئة الآن... قِرطاس صار كتابًا لطيفًا', 'good', 2400); await homeworkGate('library'); } else await enterLibrary(); }
      else await enterRoom(i);
    },
  });
}
async function exitToYard() {
  G.lock++;
  SFX.play('door');
  await fade(true);
  setArea('yard');
  placePlayer(0, -19.5, 0);
  await fade(false);
  G.lock--;
  refreshTip();
}
let currentInteract = null;

/* ---------------- حلقة التحديث ---------------- */
const tmp = new V3();
function angleLerp(a, b, t) { let d = ((b - a + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI; return a + d * t; }

const powerLevel = () => Math.min(5, Math.floor(skillPoints() / 6));
const POWER_COLORS = [0xffffff, 0xffe066, 0x7be3a6, 0x5bc0ff, 0xc28bff, 0xff7ab8];
function levelUp() {
  const lv = powerLevel();
  SFX.play('win');
  burst(P.pos.clone().add(new V3(0, 1, 0)), POWER_COLORS[lv], 40, 6, 0.5);
  toast(RX.levelUp.replace('{n}', lv), 'good', 3200);
  P.cheer = 1.4;
}
// هالة القوة حول البطل
function updateAura(dt) {
  const lv = powerLevel();
  if (!player.aura) {
    player.aura = glow(0xffffff, 2, player.g); player.aura.position.y = 1;
    player.ring = mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 }), 0, 0.05, 0, player.g);
    player.ring.rotation.x = -PI / 2;
  }
  player.aura.visible = player.ring.visible = lv > 0;
  if (!lv) return;
  player.aura.material.color.setHex(POWER_COLORS[lv]);
  player.ring.material.color.setHex(POWER_COLORS[lv]);
  player.aura.scale.setScalar(1.6 + lv * 0.35 + Math.sin(G.time * 4) * 0.15);
  player.aura.material.opacity = 0.35 + lv * 0.06;
  player.ring.scale.setScalar(1 + lv * 0.12 + Math.sin(G.time * 3) * 0.05);
  player.ring.rotation.z += dt * 2;
  player.g.scale.setScalar(1 + lv * 0.03);
}
function updatePlayer(dt) {
  const canMove = G.lock === 0 && G.playing;
  let ix = 0, iz = 0;
  if (canMove) {
    const m = (d) => Object.keys(MOVE).some((k) => keys[k] && MOVE[k] === d);
    ix = (m('r') ? 1 : 0) - (m('l') ? 1 : 0) + joy.x;
    iz = (m('f') ? 1 : 0) - (m('b') ? 1 : 0) + joy.y;
    if (keys.KeyQ) G.camYaw += 1.8 * dt;
    if (keys.KeyR) G.camYaw -= 1.8 * dt;
  }
  const mag = Math.min(1, Math.hypot(ix, iz));
  const yaw = G.camYaw;
  const fwd = tmp.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  const dir = new V3(fwd.x * iz + Math.cos(yaw) * ix, 0, fwd.z * iz - Math.sin(yaw) * ix);
  const run = keys.ShiftLeft || keys.ShiftRight || touchRun;
  const speed = (run ? 7.2 : 4.4) * mag * (1 + powerLevel() * 0.07) * (0.6 + 0.4 * G.energy / 100);   // البطل الضعيف أبطأ
  if (mag > 0.1) {
    dir.normalize();
    P.pos.addScaledVector(dir, speed * dt);
    const target = Math.atan2(dir.x, dir.z);
    P.facing = angleLerp(P.facing, target, 1 - Math.exp(-dt * 12));
    // الكاميرا تعود ببطء خلف الشخصية عند المشي للأمام فقط (لا تدور وحدها)
    const rel = Math.abs(((target - (yaw + PI)) % (PI * 2) + PI * 3) % (PI * 2) - PI);
    if (rel < 1.0 && !drag) G.camYaw = angleLerp(G.camYaw, P.facing + PI, 1 - Math.exp(-dt * 1.2));
  }
  P.moving = mag > 0.1 ? speed : 0;
  if (canMove && jumpQueued && P.ground) { P.vy = 7.6 * (1 + powerLevel() * 0.06); P.ground = false; SFX.play('jump'); }
  jumpQueued = false;
  P.vy -= 20 * dt;
  P.pos.y += P.vy * dt;
  if (P.pos.y <= 0) { if (!P.ground && P.vy < -4) SFX.play('land'); P.pos.y = 0; P.vy = 0; P.ground = true; }
  collide(P.pos, 0.42);
  for (const t of team) {                           // الأصدقاء أجسام صلبة: لا يمرّ البطل من خلالهم
    const o = t.obj.position, dx = P.pos.x - o.x, dz = P.pos.z - o.z, d = Math.hypot(dx, dz);
    if (t.obj.visible && d < 0.8 && d > 1e-4) { P.pos.x = o.x + dx / d * 0.8; P.pos.z = o.z + dz / d * 0.8; }
  }
  if (G.area === 'yard') { P.pos.x = Math.max(-32.5, Math.min(32.5, P.pos.x)); P.pos.z = Math.max(-23.3, Math.min(28.6, P.pos.z)); }
  // تحريك النموذج
  const g = player.g;
  g.position.copy(P.pos);
  g.rotation.y = P.facing;
  if (P.moving) P.walkT += dt * (4 + P.moving * 1.6);
  const sw = P.moving ? Math.sin(P.walkT) * Math.min(1, P.moving / 4) : 0;
  player.hipL.rotation.x = sw * 0.8; player.hipR.rotation.x = -sw * 0.8;
  player.shL.rotation.x = -sw * 0.9; player.shR.rotation.x = sw * 0.9;
  player.shL.rotation.z = player.shR.rotation.z = 0;
  if (!P.moving && P.ground) {                      // وقوف: تنفّس، وأرجحة خفيفة لليدين، والتفات بالرأس
    player.shL.rotation.x = Math.sin(G.time * 1.6) * 0.08; player.shR.rotation.x = -Math.sin(G.time * 1.6) * 0.08;
    player.head.rotation.y = Math.sin(G.time * 0.7) * 0.35;
  } else player.head.rotation.y = 0;
  if (!P.ground) { player.shL.rotation.x = player.shR.rotation.x = -2.4; player.hipL.rotation.x = 0.5; player.hipR.rotation.x = -0.3; }
  P.cheer = Math.max(0, (P.cheer || 0) - dt);
  if (P.cheer > 0) {                                // فرح: اليدان للأعلى ودورة صغيرة
    player.shL.rotation.x = player.shR.rotation.x = -2.9;
    player.shL.rotation.z = -0.3; player.shR.rotation.z = 0.3;
    g.rotation.y = P.facing + (1 - P.cheer / 1.4) * PI * 2 * (P.cheer > 0.7 ? 1 : 0);
  }
  player.torso.position.y = 0.98 + (P.moving ? Math.abs(Math.sin(P.walkT)) * 0.05 : Math.sin(G.time * 2) * 0.012);
  player.head.position.y = 1.56 + (P.moving ? Math.abs(Math.sin(P.walkT)) * 0.04 : Math.sin(G.time * 2) * 0.012);
  if (g.userData.glb) setAnim(g, !P.ground || (P.moving && run) ? 'run' : P.moving ? 'walk' : 'idle', P.moving ? Math.max(0.8, P.moving / (run ? 7.2 : 4.4)) : 1);
  updateAura(dt);
  player.marker.visible = !(dlg.speaker && !$('dialog').hidden);   // اسم التلميذ فوق رأسه دائمًا، إلا حين تقترب الكاميرا من متكلّم
  if (P.grace > 0) { P.grace -= dt; g.visible = P.grace <= 0 || Math.floor(P.grace * 10) % 2 === 0; }
}

function updateTeam(dt) {
  let leader = P.pos;
  team.forEach((t, i) => {
    const o = t.obj.position;
    const d = Math.hypot(leader.x - o.x, leader.z - o.z);
    const gap = i === 0 ? 1.8 : 1.4;
    let moving = false;
    if (d > gap) {
      const sp = Math.min(d - gap, 9 * dt * (d > 6 ? 2 : 1));
      o.x += (leader.x - o.x) / d * sp; o.z += (leader.z - o.z) / d * sp;
      moving = true;
    }
    if (d > 25) o.set(leader.x + 1, 0, leader.z + 1);
    if (t.obj.userData.glb) {                    // شخصية متحركة: تلتفت إلى اتجاه سيرها وتمشي أو تجري
      if (moving) t.obj.rotation.y = angleLerp(t.obj.rotation.y, Math.atan2(leader.x - o.x, leader.z - o.z), 1 - Math.exp(-dt * 10));
      const v = moving ? Math.min(d - gap, 9 * (d > 6 ? 2 : 1)) : 0;
      setAnim(t.obj, !moving ? 'idle' : (P.moving > 5 || d > 4 ? 'run' : 'walk'), moving ? Math.max(0.7, Math.min(1.4, v / 4)) : 1);
    } else if (t.obj.userData.plane) t.obj.userData.plane.position.y = moving ? Math.abs(Math.sin(G.time * 12 + i)) * 0.12 : 0;
    leader = o;
  });
}

const PATROL = [[LX - 10, 4], [LX - 1, -5], [LX + 10, -1], [LX + 2, 9], [LX - 7, -4], [LX + 7, 4]];
function updateMonster(dt) {
  if (!monster.g.visible) return;
  const M = monster, g = M.g;
  const t = G.time;
  // الحركة حسب الحالة
  if (M.state === 'patrol' || M.state === 'chase' || M.state === 'search') {
    if (M.calm > 0) M.calm -= dt;
    const canChase = G.lock === 0 && G.playing && P.grace <= 0 && !(M.calm > 0);
    const eye = g.position.clone().setY(1.5), me = P.pos.clone().setY(1.5);
    const dist = eye.distanceTo(me);
    P.hidden = lib.hides.some((h) => Math.hypot(h.x - P.pos.x, h.z - P.pos.z) < 1.7);
    const sees = canChase && !P.hidden && dist < 10 && !lineBlocked(eye, me);
    if (canChase && !P.hidden && dist < 11) warnMonster();
    if (sees) { if (M.state !== 'chase') { SFX.play('growl'); M.alert = 0.8; } M.state = 'chase'; M.lost = 0; M.target.copy(P.pos); }
    else if (M.state === 'chase') { M.lost += dt; if (M.lost > 1.6 || P.hidden) { M.state = 'search'; M.searchT = 2; } }
    if (M.state === 'search') { M.searchT -= dt; if (M.searchT <= 0) M.state = 'patrol'; }
    let goal;
    if (M.state === 'chase') goal = P.hidden ? M.target : P.pos;
    else if (M.state === 'patrol') {
      const w = PATROL[M.wp];
      goal = new V3(w[0], 0, w[1]);
      if (Math.hypot(goal.x - g.position.x, goal.z - g.position.z) < 1) M.wp = (M.wp + 1) % PATROL.length;
    }
    if (goal) {
      const sp = M.state === 'chase' ? 3.9 : 2.2;
      const dx = goal.x - g.position.x, dz = goal.z - g.position.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; g.rotation.y = angleLerp(g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6)); }
      const before = g.position.clone();
      collide(g.position, 1.0);
      if (M.state === 'patrol' && before.distanceTo(g.position) > sp * dt * 0.7) M.wp = (M.wp + 1) % PATROL.length;
    }
    g.position.y = 0;
    // أمسك اللاعب: عودة لطيفة إلى المدخل بلا خسارة
    if (canChase && !P.hidden && Math.hypot(P.pos.x - g.position.x, P.pos.z - g.position.z) < 1.3) caught();
  } else if (M.state === 'float') {
    g.position.y = 2.6 + Math.sin(t * 1.5) * 0.3;
    g.rotation.y = angleLerp(g.rotation.y, Math.atan2(P.pos.x - g.position.x, P.pos.z - g.position.z), 1 - Math.exp(-dt * 3));
  } else if (M.state === 'circle') {
    const a = t * 0.35;
    g.position.set(LX + Math.cos(a) * 6.5, 3.6 + Math.sin(t * 1.3) * 0.4, -21 + Math.sin(a) * 4.5);
    g.rotation.y = Math.atan2(P.pos.x - g.position.x, P.pos.z - g.position.z);
  }
  // الحجم يتبع القوة
  if (M.alive && M.targetScale) { const s = M.inner.scale.x; M.inner.scale.setScalar(s + (M.targetScale - s) * (1 - Math.exp(-dt * 3))); }
  // حركات الجسم: الأجنحة، الضحك، الألم
  M.wings.forEach((w) => { w.pivot.rotation.y = w.s * (0.5 + Math.sin(t * 6) * 0.35); });
  M.arms.forEach((a, k) => { a.sh.rotation.z = a.sx * (M.state === 'chase' ? 1.4 : 0.55 + Math.sin(t * 2.2 + k * PI) * 0.2); a.sh.rotation.x = M.state === 'chase' ? -0.9 : Math.sin(t * 1.7 + k) * 0.25; });
  M.tail.rotation.y = Math.sin(t * 3) * 0.5;
  M.inner.position.y = Math.sin(t * 3) * 0.08;
  if (M.hurt > 0) { M.hurt -= dt; M.inner.rotation.z = Math.sin(M.hurt * 40) * 0.2; M.body.material = mat(0xff6b6b); }
  else { M.inner.rotation.z = 0; M.body.material = mat(0x7b3fe4); }
  if (M.laugh > 0) { M.laugh -= dt; M.inner.position.y += Math.abs(Math.sin(M.laugh * 25)) * 0.2; }
  if (M.state !== 'defeated') M.inner.rotation.y = 0;
  M.name.position.y = 1.2 + 1.9 * M.inner.scale.x;
  M.letters.forEach((l, i) => {
    const a = l.a + t * 1.4, R = 1.6 * M.inner.scale.x;
    l.l.position.set(Math.cos(a) * R, (1.6 + Math.sin(t * 2 + i) * 0.4) * M.inner.scale.x, Math.sin(a) * R);
  });
  // العيون تتبع اللاعب
  const loc = g.worldToLocal(P.pos.clone().setY(1.2));
  loc.normalize();
  M.eyes.forEach((e) => { e.p.position.set(loc.x * 0.12, loc.y * 0.08 + 0.02, 0.2); });
  if (M.state === 'search') M.inner.rotation.y = Math.sin(t * 4) * 0.6;
}
async function caught() {
  hurtHero(15);
  SFX.play('boo');
  P.grace = 2.2;
  toast(C.tips.caught, 'bad', 2600);
  burst(P.pos.clone().setY(1), 0xb388ff, 24, 4);
  await fade(true, true);
  placePlayer(LX, 6.5, PI);
  monster.g.position.set(LX, 0, -4);
  monster.state = 'patrol'; monster.wp = 1; monster.calm = 3;
  await fade(false);
}

function updateWorld(dt) {
  const t = G.time;
  // نجوم
  for (const s of allStars()) {
    if (!s.obj.visible) continue;
    s.obj.rotation.y = t * 2;
    s.obj.position.y = (s.y || 1.1) + Math.sin(t * 3 + s.obj.position.x) * 0.15;
    if (G.lock === 0 && s.obj.position.distanceTo(P.pos.clone().add(new V3(0, 1, 0))) < 1.3) {
      s.obj.visible = false; G.stars.add(s.id);
      SFX.play('star'); burst(s.obj.position, 0xffd23f, 16, 3);
      setEnergy(G.energy + 15);
      P.cheer = 0.7;
      gainSkill(s.obj.userData.skill);
    }
  }
  // صفحات
  if (G.stage === 'libA' && G.area === 'library') {
    lib.pages.forEach((p) => {
      if (p.taken) return;
      p.obj.rotation.y = t * 1.5;
      p.obj.position.y = 1 + Math.sin(t * 2.4 + p.obj.position.x) * 0.2;
      if (G.lock === 0 && Math.hypot(p.obj.position.x - P.pos.x, p.obj.position.z - P.pos.z) < 1.2) {
        p.taken = true; p.obj.visible = false; G.pages++;
        SFX.play('page'); burst(p.obj.position, 0xfffaf0, 20, 3);
        toast(G.pages < 5 ? `📄 صفحة ${G.pages} من 5` : '📄 جمعتَ كل الصفحات! اذهب إلى منصة القراءة', 'good', 2200);
        if (G.pages >= 5) lib.lecternGlow.visible = true;
        refreshTip();
      }
    });
  }
  // بلاطات الجسر
  if (G.stage === 'libB' && G.lock === 0 && !G.busy) {
    const tile = lib.tiles.find((tt) => Math.abs(P.pos.x - tt.x) < 1.5 && Math.abs(P.pos.z - tt.z) < 1.25 && P.pos.y < 0.05);
    if (tile && tile !== lastTile) stepTile(tile);
    lastTile = tile || null;
  }
  // كتب التعويذة
  if (G.stage === 'libC') {
    lib.books.forEach((b, i) => {
      if (b.done) return;
      b.cool = Math.max(0, b.cool - dt);
      b.obj.position.y = b.base.y + Math.sin(t * 2 + i) * 0.25;
      b.obj.rotation.y = Math.sin(t + i) * 0.4;
      const head = P.pos.y + 1.3;
      if (G.lock === 0 && !G.busy && Math.hypot(b.obj.position.x - P.pos.x, b.obj.position.z - P.pos.z) < 1.15 && Math.abs(head - b.obj.position.y) < 0.75) touchBook(b);
    });
  }
  if (lib.exitGlow.visible) lib.exitGlow.material.opacity = 0.7 + Math.sin(t * 3) * 0.3;
  if (lib.lecternGlow.visible) lib.lecternGlow.scale.setScalar(3 + Math.sin(t * 4) * 0.5);
  // الساحة
  yard.clouds.forEach((c) => { c.position.x += dt * 0.8; if (c.position.x > 80) c.position.x = -80; });
  const d0 = yard.doors[0];
  if (d0.arrow.visible) d0.arrow.position.y = 7.6 + Math.sin(t * 4) * 0.3;
  if (d0.glow.visible) d0.glow.material.opacity = 0.55 + Math.sin(t * 2) * 0.25;
  if (shtshouta.userData.mark.visible) shtshouta.userData.mark.position.y = 1.85 + Math.abs(Math.sin(t * 3)) * 0.2;
  yard.bookGlow.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
  shadows.forEach((s) => { s.rotation.y = t * 3; });
  // الشخصيات المسطحة تواجه الكاميرا
  // الصور المسطحة تواجه الكاميرا؛ الشخصيات المتحركة الواقفة تلتفت بهدوء نحو اللاعب
  const inTeam = (o) => team.some((t) => t.obj === o);
  for (const o of [shtshout, shtshouta, ...yard.friends, ...(window.extraChars || [])]) {
    if (o.userData.seated) continue;
    if (o.userData.glb) {
      if (!inTeam(o) && o !== dlg.speaker) o.rotation.y = angleLerp(o.rotation.y, Math.atan2(P.pos.x - o.position.x, P.pos.z - o.position.z), 1 - Math.exp(-dt * 3));
    } else o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
  }
  for (const o of glbChars) o.userData.glb.mixer.update(dt);
  // جسيمات
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.v.y -= 6 * dt;
    p.sp.position.addScaledVector(p.v, dt);
    p.sp.material.opacity = 1 - p.age / p.life;
    if (p.age >= p.life) { scene.remove(p.sp); p.sp.material.dispose(); particles.splice(i, 1); }
  }
}

function updateInteract() {
  currentInteract = null;
  if (G.lock === 0 && G.playing && !G.busy) {
    let best = 1e9;
    for (const it of interactables) {
      if (!it.on()) continue;
      const p = it.at();
      if (!p) continue;
      const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
      if (d < it.r && d < best) { best = d; currentInteract = it; }
    }
  }
  const pr = $('prompt');
  if (currentInteract) {
    pr.hidden = false;
    pr.innerHTML = isTouch ? `اضغط «تفاعل»: ${currentInteract.label}` : `اضغط <kbd>E</kbd>: ${currentInteract.label}`;
  } else pr.hidden = true;
  // الدخول بالمشي إلى الباب مباشرة، دون الحاجة إلى زر
  if (G.lock === 0 && !G.busy && (G.stage === 'yard2' || G.stage === 'done') && G.area === 'yard' && P.pos.z < -22.4 && Math.abs(P.pos.x) < 2.2) { G.busy = true; enterHall().then(() => { G.busy = false; }); }
  if (useQueued && currentInteract) { const it = currentInteract; useQueued = false; it.act(); }
  useQueued = false;
}

const ray = new THREE.Raycaster();
function desiredCam() {
  const head = P.pos.clone().add(new V3(0, 1.5, 0));
  const off = new V3(Math.sin(G.camYaw) * Math.cos(G.camPitch), Math.sin(G.camPitch), Math.cos(G.camYaw) * Math.cos(G.camPitch));
  let dist = G.camDist;
  ray.set(head, off); ray.far = dist;
  const hit = ray.intersectObjects(camBlockers, false)[0];
  if (hit) dist = Math.max(1.2, hit.distance - 0.3);
  return { pos: head.clone().addScaledVector(off, dist), look: head.clone().add(new V3(0, 0.2, 0)) };
}
const camLook = new V3();
function snapCamera() {
  const c = G.cam || desiredCam();
  camera.position.copy(c.pos); camLook.copy(c.look); camera.lookAt(camLook);
}
function updateCamera(dt) {
  if (!G.playing && !G.cam) {                 // شاشة العنوان: جولة بطيئة في الساحة
    const a = G.time * 0.08;
    camera.position.set(Math.sin(a) * 26, 11, 6 + Math.cos(a) * 26);
    camLook.set(0, 3, -6); camera.lookAt(camLook);
    return;
  }
  const talk = dlg.speaker && !$('dialog').hidden;
  const c = talk ? speakerCam() : G.cam || desiredCam();
  const k = 1 - Math.exp(-dt * (talk || G.cam ? c.speed : 10));
  camera.position.lerp(c.pos, k);
  camLook.lerp(c.look, k);
  camera.lookAt(camLook);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
function step(dt) {
  if (!G.paused) {
    G.time += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
    if (G.playing) { updatePlayer(dt); updateTeam(dt); updateMonster(dt); updateInteract(); }
    updateWorld(dt);
    updateRoom(dt);
    if (G.playing && G.stage === 'libA') { const was = $('tip').textContent; refreshTip(); if (was !== $('tip').textContent && P.hidden) SFX.play('blip'); }
    updateHud();
  }
}
// للاختبار الآلي فقط: تقديم المحاكاة ثوانيَ محددة دون انتظار الإطارات
async function sim(sec) {
  for (let t = 0; t < sec; t += 1 / 60) {
    step(1 / 60); updateCamera(1 / 60);
    for (let k = 0; k < 4; k++) await null;
  }
  renderer.render(scene, camera);
}

/* ---------------- القوائم ---------------- */
function startPlaying() {
  G.playing = true;
  $('title').hidden = true;
  $('hud').classList.remove('hidden');
  $('touch').hidden = !isTouch;
}
function resetProgress() {
  G.stars.clear(); G.cleared.clear(); G.skills = {}; G.energy = 100; G.wordsDone = ''; G.kidnapped = false; G.vitamins = false; renderSkills();
  team.length = 0; renderTeam();
  allStars().forEach((s) => { s.obj.visible = true; });
}
function applyStars() { allStars().forEach((s) => { s.obj.visible = !G.stars.has(s.id); }); }

async function newGame() {
  SFX.init();
  resetProgress();
  G.stage = 'intro'; save();
  await fade(true);
  startPlaying();
  G.lock = 0;
  await playIntro();
}
async function continueGame(sv) {
  SFX.init();
  resetProgress();
  sv.stars.forEach((s) => G.stars.add(s)); applyStars();
  G.skills = sv.skills || {}; renderSkills();
  G.energy = sv.energy === undefined ? 100 : sv.energy;
  G.wordsDone = sv.wordsDone || '';
  G.kidnapped = !!sv.kidnapped; G.vitamins = !!sv.vitamins;
  G.cleared = new Set(sv.cleared || []);
  setHero(sv.hero || 'boy');
  setPlayerName(sv.name || '');
  applyGrade(sv.grade || 3);
  G.stage = sv.stage;
  player.g.visible = true;
  await fade(true);
  startPlaying();
  G.lock = 0;
  yard.friends.forEach((f, i) => { if (i) f.visible = false; });
  yard.bookLid.rotation.z = 2.6;
  const inLib = ['libA', 'libB', 'libC', 'rescued'].includes(G.stage);
  if (G.stage === 'intro') { await playIntro(); return; }
  if (G.stage !== 'yard') { joinTeam(shtshouta, C.names.shtshouta); joinTeam(shtshout, C.names.shtshout); }
  if (inLib) {
    setupLibrary(G.stage);
    setArea('library');
    placePlayer(LX, G.stage === 'libA' ? 6.5 : G.stage === 'libB' ? -2 : -15, PI);
  } else {
    setArea('yard');
    friend1.visible = G.stage === 'done';
    if (G.stage === 'done') { joinTeam(friend1, C.names.friend); yard.doors[0].leaf.material = mat(0x7be3a6); yard.doors[0].glow.visible = false; }
    // الأصدقاء الذين أُنقذوا من غرفهم يعودون إلى الفريق
    for (const id of RX.order) {
      const cp = RC[id] && RC[id].captive;
      if (!cp || !G.cleared.has(id)) continue;
      const f = yard.friends[1 + Object.keys(STUDENTS).indexOf(cp.sprite)];
      f.visible = true; f.scale.setScalar(1);
      joinTeam(f, cp.name);
    }
    shtshout.position.set(-2.2, 0, 5.6); shtshouta.position.set(-0.6, 0, 6.4);
    shtshouta.userData.mark.visible = G.stage === 'yard';
    yard.doors[0].arrow.visible = G.stage === 'yard2';
    placePlayer(0, 21, PI);
  }
  await fade(false);
  refreshTip();
  toast('أهلًا بعودتك! أكمل من آخر نقطة', 'good');
}
// لوحة «مهاراتي»: شريط ونجوم لكل مهارة
function renderSkills() {
  const list = $('skillsList');
  if (!list) return;
  list.innerHTML = SKILLS.map((k) => {
    const lv = skillLevel(k.id);
    return '<div class="skill-row"><span class="skill-ic">' + k.icon + '</span><b>' + k.name + '</b><div class="skill-bar"><i style="width:' + lv * 20 + '%;background:' + k.color + '"></i></div><small>' + '★'.repeat(lv) + '☆'.repeat(5 - lv) + '</small></div>';
  }).join('');
  $('skillsLevel').textContent = 'مستوى بطلك: ' + powerLevel() + ' من 5 · مجموع النقاط: ' + skillPoints();
}
$('hudStars').onclick = () => { renderSkills(); $('skills').hidden = false; G.paused = true; };
$('skillsClose').onclick = () => { $('skills').hidden = true; G.paused = false; };
function togglePause() {
  G.paused = !G.paused;
  $('pause').hidden = !G.paused;
}

/* ---------------- الصف الدراسي (1-9) ---------------- */
// أسئلة كل غرفة ونصوص المكتبة على قدر مستوى التلميذ: content/grades-*.js
// المحتوى الأصلي في rooms.js وlevel1.js يبقى احتياطًا لأي صف بلا محتوى خاص.
const GRADE_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
const BASE_CONTENT = { pages: C.story.pages, rounds: C.wordBridge.rounds, steps: Object.fromEntries(Object.keys(RC).map((id) => [id, RC[id].steps])) };
const gradeData = () => (window.GRADES || {})[G.grade];
function applyGrade(g) {
  G.grade = g;
  const d = gradeData();
  C.story.pages = (d && d.library && d.library.pages) || BASE_CONTENT.pages;
  C.wordBridge.rounds = (d && d.library && d.library.rounds) || BASE_CONTENT.rounds;
  const lib2 = HW.custom(g, 'library');
  if (lib2) { if (lib2.pages) C.story.pages = lib2.pages; if (lib2.rounds) C.wordBridge.rounds = lib2.rounds; }
  for (const id in RC) RC[id].steps = (d && d[id] && d[id].steps) || BASE_CONTENT.steps[id];
  $('btnGrade').textContent = '📚 الصف ' + GRADE_NAMES[g - 1] + ' · تغيير الصف';
  save();
}
// صوت جملة الاستماع: لكل صف معرّف خاص به (إن لم يُسجَّل صوته يقرؤها صوت المتصفح العربي)
if (window.speechSynthesis) speechSynthesis.getVoices();   // تحميل الأصوات مبكرًا
const listenId = (room, k) => (gradeData() && gradeData()[room] ? 'g' + G.grade + '-' : '') + 'listen-' + room + '-' + k;
let gradeThen = null;   // ما يحدث بعد اختيار الصف: بدء لعبة جديدة، أو العودة إلى اللعب
$('gradeRow').innerHTML = GRADE_NAMES.map((n, i) => '<button class="grade-card" data-grade="' + (i + 1) + '"><b>' + (i + 1) + '</b>الصف ' + n + '</button>').join('');
document.querySelectorAll('#gradePick [data-grade]').forEach((b) => { b.onclick = () => { $('gradePick').hidden = true; applyGrade(+b.dataset.grade); const f = gradeThen; gradeThen = null; f && f(); }; });

// اختيار البطل ثم الصف قبل بدء المغامرة
$('btnNew').onclick = () => { $('heroPick').hidden = false; };
document.querySelectorAll('#heroPick [data-hero]').forEach((b) => { b.onclick = () => { $('heroPick').hidden = true; setHero(b.dataset.hero); gradeThen = askName; $('gradePick').hidden = false; }; });
// اسم التلميذ يظهر فوق رأس بطله بدل «أنت»
function askName() { $('nameInput').value = G.name || ''; $('namePick').hidden = false; setTimeout(() => $('nameInput').focus(), 50); }
function setPlayerName(n) {
  G.name = n;
  const old = player.marker;
  player.marker = label(n || 'أنت', 0.22, { size: 46, border: player.hero === 'girl' ? '#e84d8a' : '#ff8a3d' }, player.g);
  player.marker.position.copy(old.position);
  player.g.remove(old);
  save();
}
function nameGo() {
  const n = $('nameInput').value.trim().replace(/\s+/g, ' ').slice(0, 14);
  if (!n) { $('nameInput').focus(); $('nameInput').classList.add('shake'); setTimeout(() => $('nameInput').classList.remove('shake'), 400); return; }
  $('namePick').hidden = true;
  setPlayerName(n);
  newGame();
}
$('nameGo').onclick = nameGo;
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') nameGo(); });
// تغيير الصف أثناء اللعب (من قائمة الاستراحة): الغرف التي لم تُهزم بعد تأخذ أسئلة الصف الجديد
$('btnGrade').onclick = () => { $('pause').hidden = true; gradeThen = () => { G.paused = false; toast('صارت الأسئلة على قدر الصف ' + GRADE_NAMES[G.grade - 1], 'good', 2600); }; $('gradePick').hidden = false; };
$('btnContinue').onclick = () => { const sv = loadSave(); if (sv) continueGame(sv); };
$('btnAsk').onclick = () => { askFriend(); $('btnAsk').blur(); };
HW.init({ rooms: SC.rooms.filter((r) => r.id === 'library' || (RC[r.id] && !RC[r.id].boss)).map((r) => ({ id: r.id, name: r.name })), editRooms: SC.rooms.filter((r) => r.id === 'library' || RC[r.id]).map((r) => ({ id: r.id, name: r.name })), grades: GRADE_NAMES, bank: teacherBank, name: () => G.name || '', onTimeout: () => hurtHero(25) });
$('btnPauseHw').onclick = () => HW.openList();
$('btnHelp').onclick = () => { $('help').hidden = false; };
$('btnHelpClose').onclick = () => { $('help').hidden = true; };
$('btnPause').onclick = () => togglePause();
$('btnResume').onclick = () => togglePause();
$('btnPauseHelp').onclick = () => { $('help').hidden = false; };
$('btnRestart').onclick = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ stage: 'intro', stars: [] })); } catch (e) { /* */ } location.reload(); };
$('btnReplay').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } location.reload(); };
$('btnMute').onclick = () => { SFX.init(); const on = SFX.toggle(); $('btnMute').textContent = on ? '🔊' : '🔇'; voice.muted = !on; };
// زر الشاشة الكاملة: يظهر فقط حيث يسمح المتصفح بها (لا يدعمها الآيفون)
const fsRoot = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) $('btnFull').hidden = false;
$('btnFull').onclick = () => {
  $('btnFull').blur();   // حتى لا تضغطه المسافة (القفز) مرة أخرى
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot);
};
const fsLabel = () => { const on = !!fsElement(), t = on ? 'خروج من الشاشة الكاملة' : 'شاشة كاملة'; $('btnFull').title = t; $('btnFull').setAttribute('aria-label', t); };
document.addEventListener('fullscreenchange', fsLabel);
document.addEventListener('webkitfullscreenchange', fsLabel);

/* ---------------- التشغيل ---------------- */
async function boot() {
  try { await Promise.race([document.fonts.load(`900 64px Tajawal`), wait2(2500)]); } catch (e) { /* خط النظام */ }
  buildWorld();
  if (window.LIB_LOOK) LIB_LOOK.init({ scene, LX, G, mat, mesh, box, glow, woodTex, canvasTex, matCache, hemi, texLoader });   // المكتبة الحقيقية: js/library-look.js
  if (window.YARD_LOOK) YARD_LOOK.init({ scene, yard, hemi, sun, mat, mesh, box, glow, canvasTex, woodTex, texLoader, addCol, yardImg: { w: 1672, h: 941, src: 'assets/rooms/yard.webp' } });   // الساحة بأسلوب صورة الأستاذة: js/yard-look.js
  setArea('yard');
  yard.friends.forEach((f, i) => { const a = i / 6 * PI * 2; f.position.set(Math.cos(a) * 4, 0, 1 + Math.sin(a) * 4); });
  player.g.visible = false;
  const cast = $('titleCast');
  for (const k of ['shtshout', 'shtshouta', 'mongia']) { const im = new Image(); im.src = S[k].src; im.alt = C.names[k]; cast.appendChild(im); }
  const sv = loadSave();
  if (sv && sv.stage && sv.stage !== 'intro') $('btnContinue').hidden = false;
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  window.__game = { G, P, lib, monster, team, interactables, sim, keys, advanceDialog, rooms, hall, enterHall, enterRoom, enterLibrary, get shtshout() { return shtshout; }, get shtshouta() { return shtshouta; }, get roomRun() { return roomRun; } };   // للاختبار من وحدة التحكم
}
function wait2(ms) { return new Promise((r) => setTimeout(r, ms)); }
boot();
})();
