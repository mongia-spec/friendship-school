// شخصيات ثلاثية الأبعاد متحركة (مجسمات Quaternius المجانية CC0 + مكتبة حركاتها).
// الملابس تُلوَّن حسب موضع كل نقطة في الجسم (ارتفاعها وبعدها عن المنتصف)، فلا نحتاج خامات ثقيلة.
// الأزياء مأخوذة من الصور المرجعية: الألوان والشعر والملابس، والوجه كرتوني.
window.Chars = (() => {
  'use strict';
  const M = window.MODELS;
  const loader = new THREE.GLTFLoader();
  const parse = (json) => new Promise((res, rej) => loader.parse(JSON.stringify(json), '', res, rej));
  const base = {}, hair = {}, clips = {};

  const ready = (async () => {
    [base.male, base.female] = await Promise.all([parse(M.male), parse(M.female)]);
    for (const k of Object.keys(M.hair)) hair[k] = await parse(M.hair[k]);
    for (const j of M.anims) {
      const c = THREE.AnimationClip.parse(j);
      // لا نحرّك الحجم ولا الجذر: الحجم نضبطه نحن (طفل/كبير)، والموضع يحرّكه كود اللعبة
      c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale') && t.name !== 'root.position');
      clips[c.name] = c;
    }
  })();

  const C = (hex) => new THREE.Color(hex);
  const mix = (a, b, k) => a.clone().lerp(b, k);

  // ---- أزياء الشخصيات: كل دالة تعطي لون النقطة حسب موضعها ----
  // h: الارتفاع من 0 (القدم) إلى 1 (أعلى الرأس)، ax: البعد الأفقي عن المنتصف نسبةً للطول، z: الأمام موجب
  const SKIN_TAN = C(0xe8b48f), SKIN_LIGHT = C(0xf3c9a8);
  const OUTFITS = {
    // شتشوت: قميص مربعات وردي وأزرق، صدرية كحلية، بنطال كحلي، حذاء بني
    shtshout(h, ax, z, x, y) {
      if (h > 0.86 || (h > 0.82 && ax < 0.05)) return SKIN_LIGHT;
      if (ax > 0.33) return SKIN_LIGHT;                         // اليدان
      if (h < 0.045) return C(0x6b3a1e);                         // حذاء
      if (h < 0.5) return C(0x1d2238);                           // بنطال
      if (ax > 0.12 && h > 0.62) {                               // كمّا القميص: مربعات
        const k = (Math.floor(x * 28) + Math.floor(y * 28)) & 1;
        return k ? C(0xf2b8c6) : C(0x7d93d6);
      }
      if (h > 0.79 && ax < 0.04 && z > 0) return C(0xf2b8c6);    // ياقة القميص
      return C(0x1f2440);                                         // الصدرية
    },
    // شتشوتة: كنزة كريمية بشريط وردي وكتف أصفر، تنورة مربعات (قطعة منفصلة)، جوارب بيضاء، حذاء أسود
    shtshouta(h, ax, z, x) {
      if (h > 0.86 || (h > 0.82 && ax < 0.05)) return SKIN_LIGHT;
      if (ax > 0.33) return SKIN_LIGHT;
      if (h < 0.045) return C(0x111111);
      if (h < 0.5) return C(0xf7f5f2);                           // جوارب بيضاء
      if (h > 0.56 && h < 0.63 && ax < 0.13) return C(0xef6fa8); // الشريط الوردي
      if (h > 0.74 && x < -0.05) return C(0xf6e59a);             // الكتف الأصفر
      return C(0xf7efdf);
    },
    // ماما منجية: عباءة زرقاء فاتحة وقميص أزرق أفتح، حذاء بيج
    mongia(h, ax) {
      if (h > 0.86 || (h > 0.82 && ax < 0.05)) return SKIN_TAN;
      if (ax > 0.34) return SKIN_TAN;
      if (h < 0.04) return C(0xe4c8a8);
      if (ax < 0.09 && h > 0.45) return C(0xc8daf0);
      return C(0x9fbbdc);
    },
    // اللاعب: سترة برتقالية، بنطال جينز، حذاء أبيض
    player(h, ax) {
      if (h > 0.86 || (h > 0.82 && ax < 0.05)) return SKIN_TAN;
      if (ax > 0.33) return SKIN_TAN;
      if (h < 0.045) return C(0xffffff);
      if (h < 0.5) return C(0x3b5b9a);
      return C(0xff8a3d);
    },
    // صديق مؤقت (لا صورة مرجعية بعد): رمادي محايد مع قميص بلون غرفته
    friend(h, ax, z, x, y, color) {
      if (h > 0.82 || ax > 0.33) return C(0xd9d4e6);
      if (h < 0.5) return C(0x8b86a0);
      return C(color);
    },
  };

  function paintBody(mesh, outfit, extra) {
    const g = mesh.geometry.clone();
    mesh.geometry = g;
    g.computeBoundingBox();
    const bb = g.boundingBox, H = bb.max.y - bb.min.y;
    const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const c = outfit((y - bb.min.y) / H, Math.abs(x) / H, z, x / H, (y - bb.min.y) / H, extra);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mesh.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    return H;
  }

  function addHair(root, skeleton, name, color) {
    let src = null;
    hair[name].scene.traverse((o) => { if (o.isSkinnedMesh && !src) src = o; });
    const hm = new THREE.SkinnedMesh(src.geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    const bones = src.skeleton.bones.map((b) => skeleton.getBoneByName(b.name) || b);
    hm.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    hm.frustumCulled = false;
    root.add(hm);
    return hm;
  }

  // قطعة صلبة تتبع عظمة معيّنة (ربطة عنق، تنورة، حجاب، نظارة)
  function attach(skeleton, boneName, obj) {
    const b = skeleton.getBoneByName(boneName);
    if (b) b.add(obj);
    return obj;
  }

  function plaidTexture(a, b, c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 64, 64);
    g.globalAlpha = 0.65; g.fillStyle = b;
    for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 5, 64); g.fillRect(0, i, 64, 5); }
    g.fillStyle = c; g.globalAlpha = 0.8;
    for (let i = 8; i < 64; i += 16) { g.fillRect(i, 0, 1.5, 64); g.fillRect(0, i, 64, 1.5); }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1);
    return t;
  }

  const lam = (color, o) => new THREE.MeshLambertMaterial(Object.assign({ color }, o));

  // الأطوال النهائية بالأمتار داخل اللعبة
  const SPECS = {
    shtshout: { body: 'male', outfit: 'shtshout', height: 1.12, head: 1.32, hair: 'Hair_Buzzed', hairColor: 0x5a3a22, curls: true, tie: true },
    shtshouta: { body: 'female', outfit: 'shtshouta', height: 1.1, head: 1.32, hair: 'Hair_Long', hairColor: 0x1b1412, skirt: true, bow: true },
    mongia: { body: 'female', outfit: 'mongia', height: 1.68, head: 1.05, hijab: true, glasses: true, robe: true },
    player: { body: 'male', outfit: 'player', height: 1.3, head: 1.22, hair: 'Hair_SimpleParted', hairColor: 0x3b2314, cap: true },
    friend: { body: 'male', outfit: 'friend', height: 1.22, head: 1.25 },
  };

  function make(kind, opt = {}) {
    const sp = Object.assign({}, SPECS[kind], opt);
    const root = THREE.SkeletonUtils.clone(base[sp.body].scene);
    let body = null, skeleton = null;
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false;
      if (/Superhero/i.test(o.name)) { body = o; skeleton = o.skeleton; }
      if (/Eyebrow/i.test(o.name)) o.material = lam(sp.hairColor || 0x2a1a10);
    });
    const H = paintBody(body, OUTFITS[sp.outfit], sp.color);
    const sk = skeleton;
    if (sp.hair) addHair(body.parent, sk, sp.hair, sp.hairColor);

    // تفاصيل الأزياء
    const headSize = 0.11 * H;
    if (sp.curls) {                      // شعر مجعّد: كرات صغيرة فوق الرأس
      const g = new THREE.Group();
      const m = lam(sp.hairColor);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.75;
        const s = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.24, 7, 6), m);
        s.position.set(Math.cos(a) * r * headSize * 0.8, headSize * (0.95 + Math.random() * 0.25 - r * 0.25), Math.sin(a) * r * headSize * 0.8 - headSize * 0.1);
        g.add(s);
      }
      attach(sk, 'Head', g);
    }
    if (sp.tie) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(H * 0.035, H * 0.12, H * 0.012), lam(0x8c1d3c));
      tie.position.set(0, -H * 0.02, H * 0.085);
      attach(sk, 'spine_03', tie);
    }
    if (sp.skirt) {
      const sk2 = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.1, H * 0.17, H * 0.17, 20, 1, true),
        new THREE.MeshLambertMaterial({ map: plaidTexture('#5c6c9c', '#e05a95', '#ffffff'), side: THREE.DoubleSide }));
      sk2.position.set(0, -H * 0.03, 0);
      attach(sk, 'pelvis', sk2);
    }
    if (sp.bow) {
      const bow = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.32, 10, 8), lam(0x111111));
      bow.position.set(0, headSize * 1.05, headSize * 0.25);
      attach(sk, 'Head', bow);
    }
    if (sp.cap) {
      const cap = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.98, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xffc93c));
      dome.position.y = headSize * 0.62;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(headSize * 1.5, headSize * 0.08, headSize * 0.9), lam(0xffc93c));
      brim.position.set(0, headSize * 0.64, headSize * 0.85);
      cap.add(dome, brim);
      attach(sk, 'Head', cap);
    }
    if (sp.hijab) {
      const m = lam(0x2c3346, { side: THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(headSize * 1.08, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m);
      hood.position.set(0, headSize * 0.42, -headSize * 0.08);
      hood.rotation.x = -0.25;
      attach(sk, 'Head', hood);
      const drape = new THREE.Mesh(new THREE.ConeGeometry(H * 0.15, H * 0.2, 20, 1, true), m);
      drape.position.set(0, H * 0.02, 0);
      attach(sk, 'neck_01', drape);
      const back = new THREE.Mesh(new THREE.SphereGeometry(headSize * 1.05, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), m);
      back.position.set(0, headSize * 0.35, -headSize * 0.12);
      attach(sk, 'Head', back);
    }
    if (sp.glasses) {
      const g = new THREE.Group(), m = lam(0xd4b06a);
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(headSize * 0.2, headSize * 0.025, 6, 18), m);
        ring.position.set(s * headSize * 0.26, headSize * 0.42, headSize * 0.92);
        g.add(ring);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.14, headSize * 0.03, headSize * 0.03), m);
      bridge.position.set(0, headSize * 0.45, headSize * 0.93);
      g.add(bridge);
      attach(sk, 'Head', g);
    }
    if (sp.robe) {                       // العباءة المفتوحة الطويلة
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.13, H * 0.22, H * 0.52, 24, 1, true, Math.PI * 0.15, Math.PI * 1.7),
        lam(0x8fb0d6, { side: THREE.DoubleSide }));
      robe.position.set(0, -H * 0.2, 0);
      attach(sk, 'pelvis', robe);
    }

    // تحويل إلى المقاس النهائي: الطول المطلوب ورأس أكبر للأطفال
    const head = sk.getBoneByName('Head');
    if (head && sp.head !== 1) head.scale.setScalar(sp.head);
    const holder = new THREE.Group();
    const s = sp.height / H;
    root.scale.setScalar(s);
    holder.add(root);

    // الحركات
    const mixer = new THREE.AnimationMixer(root);
    const acts = {};
    for (const name in clips) {
      const a = mixer.clipAction(clips[name]);
      if (/Jump_Start|Jump_Land|Interact|Hit_Chest|Roll/.test(name)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      acts[name] = a;
    }
    let cur = null, oneShot = null;
    function play(name, fade = 0.2, speed = 1) {
      const a = acts[name];
      if (!a) return;
      a.timeScale = speed;
      if (cur === name) return;
      a.reset().fadeIn(fade).play();
      if (cur && acts[cur]) acts[cur].fadeOut(fade);
      cur = name;
    }
    function once(name, then = 'Idle_Loop') {
      play(name, 0.12);
      oneShot = { name, then };
    }
    mixer.addEventListener('finished', (e) => {
      if (oneShot && e.action === acts[oneShot.name]) { const t = oneShot.then; oneShot = null; cur = null; play(t, 0.2); }
    });
    // اختيار الحركة حسب السرعة والقفز (السرعة بالمتر في الثانية)
    let wasAir = false;
    function locomote(speed, grounded, vy = 0) {
      if (oneShot) return;
      const k = sp.height / 1.75;                      // الأطفال يخطون خطوات أقصر
      if (!grounded) { play(vy > 0 ? 'Jump_Start' : 'Jump_Loop', 0.1); wasAir = true; return; }
      if (wasAir) { wasAir = false; once('Jump_Land', speed > 0.3 ? 'Jog_Fwd_Loop' : 'Idle_Loop'); return; }
      if (speed < 0.25) play(sp.idle || 'Idle_Loop', 0.25);
      else if (speed < 2.2) play(sp.walk || 'Walk_Loop', 0.2, speed / (1.3 * k));
      else if (speed < 5.5) play('Jog_Fwd_Loop', 0.2, speed / (3.4 * k));
      else play('Sprint_Loop', 0.2, speed / (6 * k));
    }
    play('Idle_Loop', 0);
    return { group: holder, root, mixer, play, once, locomote, update: (dt) => mixer.update(dt), height: sp.height };
  }

  return { ready, make, clips };
})();
