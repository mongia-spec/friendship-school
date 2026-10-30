// المكتبة الحقيقية الحيّة: صورة المكتبة المعتمدة (assets/rooms/library.js) تصير واجهة المكتبة،
// مع مشهد افتتاحي متحرك، وكتب وصفحات طائرة، وأضواء تتراقص. يُحمَّل قبل game.js، وgame.js يستدعيه:
// LIB_LOOK.init بعد بناء العالم، وLIB_LOOK.area عند تغيير المكان، وLIB_LOOK.intro عند دخول المكتبة.
(() => {
  const IMG = window.ROOM_IMAGES && window.ROOM_IMAGES.library;
  if (!IMG) return;
  const ASPECT = IMG.w / IMG.h, PI = Math.PI;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let K = null;                                            // أدوات اللعبة التي يمرّرها game.js

  function init(ctx) {
    K = ctx;
    const { scene, LX, G, mat, mesh, box, glow, woodTex, canvasTex, matCache, texLoader } = ctx;

    /* ---------- 1. الجدار الخلفي: الصورة كاملة بنسبتها الأصلية ---------- */
    const tex = texLoader.load(IMG.src);
    const BW = 28, BH = BW / ASPECT;                       // 28 × 15.75 متر، بلا قص
    const backdrop = mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: tex, fog: false }), LX, BH / 2, -31.97);
    backdrop.renderOrder = -1;

    // جدران المكتبة: خشب داكن دافئ بدل اللون الفاتح، وجدران عليا تحيط بالصورة
    const wood = new THREE.MeshLambertMaterial({ map: woodTex(6, 2, '#6b3b22') });
    const beige = matCache[0xe6d2ad];
    scene.traverse((o) => { if (o.isMesh && o.material === beige && Math.abs(o.position.x - LX) < 20) o.material = wood; });
    const upper = new THREE.MeshLambertMaterial({ map: woodTex(6, 2, '#4a2716'), side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const w = mesh(new THREE.PlaneGeometry(44.5, BH - 8), upper, LX + s * 14, 8 + (BH - 8) / 2, -9.75); w.rotation.y = -s * PI / 2; }
    { const w = mesh(new THREE.PlaneGeometry(28, BH - 8), upper, LX, 8 + (BH - 8) / 2, 12); w.rotation.y = PI; }
    // سقف خشبي بعوارض تتدلّى منه ثريّات دافئة
    const ceil = mesh(new THREE.PlaneGeometry(28, 44.5), new THREE.MeshLambertMaterial({ map: woodTex(4, 6, '#3a1f12'), side: THREE.DoubleSide }), LX, BH, -9.75);
    ceil.rotation.x = PI / 2;
    for (let z = 9; z > -31; z -= 5) box(28, 0.5, 0.5, 0x2a160c, LX, BH - 0.25, z);
    for (const z of [4, -10, -24]) {
      const c = new THREE.Group(); c.position.set(LX, BH - 3, z); scene.add(c);
      box(0.06, 3, 0.06, 0x2a160c, 0, 1.5, 0, c);
      box(1.6, 0.12, 1.6, mat(0xc8962e, { emissive: 0x7a5a1e, emissiveIntensity: 0.5 }), 0, 0, 0, c);
      glow(0xffc070, 4.5, c);
    }

    // أرضية لامعة تعكس الضوء كما في الصورة
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.map && o.geometry.type === 'PlaneGeometry' && o.position.y === 0 && Math.abs(o.position.x - LX) < 1) {
        o.material = new THREE.MeshPhongMaterial({ map: o.material.map, shininess: 70, specular: 0x6a4020, color: 0xd9b48a });
      }
    });

    /* ---------- 2. السحر الطائر: كتب وصفحات وشرارات ---------- */
    const pageTex = canvasTex(128, 160, (g) => {
      g.fillStyle = '#fbf3dc'; g.fillRect(6, 6, 116, 148);
      g.fillStyle = '#b8a37a'; for (let y = 28; y < 140; y += 14) g.fillRect(18, y, 70 + (y * 7 % 22), 4);
    });
    const flyers = [];
    for (let i = 0; i < 18; i++) {                          // صفحات تطير ببطء في الأعلى
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pageTex, transparent: true }));
      sp.scale.set(0.55, 0.7, 1); scene.add(sp);
      flyers.push({ o: sp, x: LX + rnd(-12, 12), y: rnd(4.5, 11), z: rnd(-30, 10), a: rnd(0, PI * 2), s: rnd(0.3, 0.7), r: rnd(0.6, 1.6) });
    }
    const COVERS = [0x5a2d82, 0x1f4e79, 0x8e2a2a, 0x3d1a80];
    for (let i = 0; i < 9; i++) {                            // كتب مسحورة متوهجة
      const g = new THREE.Group(); scene.add(g);
      box(0.9, 1.2, 0.22, mat(COVERS[i % 4], { emissive: 0x3a1670, emissiveIntensity: 0.5 }), 0, 0, 0, g);
      box(0.84, 1.12, 0.18, 0xfbf3dc, 0.05, 0, 0, g);
      box(0.3, 0.3, 0.02, mat(0xffc93c, { emissive: 0xc8962e, emissiveIntensity: 0.6 }), 0, 0, 0.12, g);
      glow(0xb388ff, 3, g);
      flyers.push({ o: g, x: LX + rnd(-11, 11), y: rnd(5, 10), z: rnd(-28, 6), a: rnd(0, PI * 2), s: rnd(0.2, 0.45), r: rnd(0.8, 2), spin: true });
    }
    const sparks = [];
    for (let i = 0; i < 70; i++) {                           // شرارات بنفسجية تصعد
      const sp = glow(i % 4 ? 0xb388ff : 0xffd27a, rnd(0.25, 0.6), scene);
      sparks.push({ o: sp, x: LX + rnd(-13, 13), y: rnd(0, 12), z: rnd(-31, 11), v: rnd(0.3, 0.9), ph: rnd(0, 9) });
    }

    // أضواء تتراقص: مصابيح ذهبية وتوهّج بنفسجي
    const warm = [], purple = [];
    for (const z of [6, -8, -22]) { const l = new THREE.PointLight(0xffb866, 0.7, 22); l.position.set(LX, 6, z); scene.add(l); warm.push(l); }
    for (const z of [-4, -26]) { const l = new THREE.PointLight(0x9b5cff, 0.8, 26); l.position.set(LX, 9, z); scene.add(l); purple.push(l); }

    let t = 0, prev = performance.now();
    (function anim(now) {
      requestAnimationFrame(anim);
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      if (G.area !== 'library' || G.paused) return;
      t += dt;
      for (const f of flyers) {
        f.a += dt * f.s;
        f.o.position.set(f.x + Math.cos(f.a) * f.r, f.y + Math.sin(f.a * 1.7) * 0.4, f.z + Math.sin(f.a) * f.r);
        if (f.spin) { f.o.rotation.y = f.a * 1.3; f.o.rotation.z = Math.sin(f.a * 2) * 0.3; }
        else f.o.material.rotation = Math.sin(f.a * 2) * 0.5;
      }
      for (const s of sparks) {
        s.y += s.v * dt; if (s.y > 13) s.y = 0;
        s.o.position.set(s.x + Math.sin(t + s.ph) * 0.4, s.y, s.z);
        s.o.material.opacity = 0.35 + 0.35 * Math.sin(t * 3 + s.ph);
      }
      warm.forEach((l, i) => { l.intensity = 0.62 + 0.1 * Math.sin(t * 9 + i * 2) + 0.05 * Math.sin(t * 23 + i); });
      purple.forEach((l, i) => { l.intensity = 0.6 + 0.35 * Math.sin(t * 1.4 + i * 1.5); });
    })(prev);
  }

  // جوّ المكتبة: ضباب أخف ليظهر عمق المكان
  function area(a) {
    if (!K || a !== 'library') return;
    K.scene.background = new THREE.Color(0x1d1450); K.scene.fog = new THREE.Fog(0x2a1a55, 38, 95); K.hemi.intensity = 0.7;
  }

  /* ---------- 3. مشهد الدخول: الصورة كاملة تتحرك قبل اللعب ---------- */
  const css = document.createElement('style');
  css.textContent = `
#libIntro{position:absolute;inset:0;z-index:45;background:#120a2e;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .6s;cursor:pointer}
#libIntro.on{opacity:1}
#libIntro .frame{position:relative;width:min(100vw,calc(100vh*${ASPECT}));aspect-ratio:${IMG.w}/${IMG.h}}
#libIntro img,#libIntro canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#libIntro img{animation:libBreath 6s ease-in-out infinite alternate}
@keyframes libBreath{from{filter:brightness(.95) saturate(1)}to{filter:brightness(1.08) saturate(1.12)}}
#libIntro h2{position:absolute;bottom:9%;left:0;right:0;margin:0;text-align:center;font-family:Lalezar,Tajawal,sans-serif;font-size:clamp(28px,6vw,64px);color:#ffe7a3;text-shadow:0 0 18px #8e5cf7,0 3px 0 #3d1a80;opacity:0;transform:translateY(12px);transition:opacity 1s .5s,transform 1s .5s}
#libIntro.on h2{opacity:1;transform:none}`;
  document.head.appendChild(css);

  // مواضع المصابيح في الصورة (نسبة من العرض والارتفاع) لتتراقص أنوارها
  const LAMPS = [[.14,.07],[.86,.07],[.13,.36],[.87,.36],[.22,.36],[.78,.36],[.29,.19],[.71,.19],[.22,.52],[.78,.52],[.34,.52],[.66,.52],[.44,.55],[.56,.55],[.5,.65]];
  function playIntro() {
    return new Promise((done) => {
      const box = document.createElement('div'); box.id = 'libIntro';
      box.innerHTML = `<div class="frame"><img alt=""><canvas></canvas><h2>المكتبة المسحورة</h2></div>`;
      box.querySelector('img').src = IMG.src;
      document.getElementById('app').appendChild(box);
      const cv = box.querySelector('canvas'), g = cv.getContext('2d');
      const pages = Array.from({ length: 10 }, () => ({ x: Math.random(), y: Math.random() * 0.45, s: rnd(0.4, 1), a: rnd(0, 6) }));
      const dust = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(0.02, 0.07), p: rnd(0, 9), gold: Math.random() < 0.3 }));
      let t0 = performance.now(), alive = true;
      (function draw(now) {
        if (!alive) return; requestAnimationFrame(draw);
        const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio, tt = (now - t0) / 1000;
        g.globalCompositeOperation = 'lighter';
        LAMPS.forEach(([x, y], i) => {                     // وهج المصابيح يرتعش
          const r = w * (0.035 + 0.006 * Math.sin(tt * 8 + i * 1.7));
          const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
          gr.addColorStop(0, `rgba(255,200,120,${0.35 + 0.12 * Math.sin(tt * 11 + i)})`); gr.addColorStop(1, 'rgba(255,170,80,0)');
          g.fillStyle = gr; g.fillRect(x * w - r, y * h - r, r * 2, r * 2);
        });
        const pr = w * 0.35, px = w / 2 + Math.sin(tt * 0.6) * w * 0.08, py = h * 0.18;   // موجة السحر البنفسجي
        const pg = g.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, `rgba(170,90,255,${0.16 + 0.1 * Math.sin(tt * 1.5)})`); pg.addColorStop(1, 'rgba(120,40,255,0)');
        g.fillStyle = pg; g.fillRect(0, 0, w, h);
        dust.forEach((d) => {                              // شرارات تصعد
          const y = ((d.y - tt * d.v) % 1 + 1) % 1, a = 0.4 + 0.5 * Math.sin(tt * 3 + d.p);
          g.fillStyle = d.gold ? `rgba(255,215,130,${a})` : `rgba(200,150,255,${a})`;
          g.beginPath(); g.arc((d.x + Math.sin(tt + d.p) * 0.01) * w, y * h, w * 0.0022, 0, 7); g.fill();
        });
        g.globalCompositeOperation = 'source-over';
        pages.forEach((p) => {                             // صفحات تطير في الأعلى
          const x = ((p.x + tt * 0.025 * p.s) % 1.1) * w, y = (p.y + Math.sin(tt * p.s + p.a) * 0.03) * h, sz = w * 0.022 * p.s + w * 0.01;
          g.save(); g.translate(x, y); g.rotate(Math.sin(tt * 1.3 + p.a) * 0.6);
          g.fillStyle = 'rgba(251,243,220,.92)'; g.fillRect(-sz / 2, -sz * 0.65, sz, sz * 1.3);
          g.fillStyle = 'rgba(150,130,100,.7)'; for (let k = 0; k < 4; k++) g.fillRect(-sz * 0.35, -sz * 0.4 + k * sz * 0.22, sz * 0.6, sz * 0.05);
          g.restore();
        });
      })(t0);
      requestAnimationFrame(() => box.classList.add('on'));
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        box.classList.remove('on');
        setTimeout(() => { alive = false; box.remove(); }, 650);
        done();
      };
      box.addEventListener('pointerdown', close);
      setTimeout(close, 4200);
    });
  }

  window.LIB_LOOK = { init, area, intro: playIntro };
})();
