// الممر الرئيسي بأسلوب صورة الأستاذة منجية (assets/rooms/hall.js):
// سقف مقبّب أزرق بعوارض، فوانيس ذهبية معلّقة ومصابيح جدارية، رخام لامع بمعيّنات زرقاء،
// ألواح خشبية ورسومات الأطفال ونباتات، وتوهّج بنفسجي عند الباب الأخير، والصورة نفسها في نهاية الممر.
// يُحمَّل قبل game.js، وgame.js يستدعي HALL_LOOK.init في آخر buildHall، وHALL_LOOK.area عند تغيير المكان.
(() => {
  const PI = Math.PI;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let K = null, lights = [], flames = [];

  // رخام كريمي بعروق خفيفة ومعيّن أزرق داكن في وسط كل بلاطة
  function marble(canvasTex) {
    return canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#efe4d2'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(150,130,110,.25)'; g.lineWidth = 2;
      for (let k = 0; k < 7; k++) { g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < w) { x += rnd(-30, 30); y += rnd(20, 50); g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#1f2a6b';
      g.beginPath(); g.moveTo(w / 2, w * 0.36); g.lineTo(w * 0.64, w / 2); g.lineTo(w / 2, w * 0.64); g.lineTo(w * 0.36, w / 2); g.fill();
      g.fillStyle = '#5a3fb0';
      g.beginPath(); g.moveTo(w / 2, w * 0.42); g.lineTo(w * 0.58, w / 2); g.lineTo(w / 2, w * 0.58); g.lineTo(w * 0.42, w / 2); g.fill();
      g.strokeStyle = 'rgba(60,40,30,.35)'; g.lineWidth = 4; g.strokeRect(0, 0, w, w);
    }, [3, 24]);
  }
  // رسمة طفل بألوان زاهية: شمس، وبيت، وشجرة، وزهور
  function drawing(canvasTex, k) {
    return canvasTex(256, 200, (g, w, h) => {
      g.fillStyle = ['#fff8e6', '#eaf6ff', '#fdf0f6', '#f2ffe8'][k % 4]; g.fillRect(0, 0, w, h);
      g.lineWidth = 6; g.lineCap = 'round';
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(40 + (k * 37) % 170, 45, 22, 0, PI * 2); g.fill();
      g.fillStyle = '#7cc66b'; g.fillRect(0, h - 40, w, 40);
      if (k % 3 === 0) { g.fillStyle = '#e8504a'; g.fillRect(120, 95, 70, 60); g.fillStyle = '#5b6bd6'; g.beginPath(); g.moveTo(110, 98); g.lineTo(155, 60); g.lineTo(200, 98); g.fill(); }
      else { g.fillStyle = '#8b5a2b'; g.fillRect(150, 90, 14, 70); g.fillStyle = '#2bb673'; g.beginPath(); g.arc(157, 85, 34, 0, PI * 2); g.fill(); }
      ['#e84d8a', '#ff8a3d', '#8e5cf7', '#3a7bd5'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(30 + i * 30, h - 48, 9, 0, PI * 2); g.fill(); });
      g.strokeStyle = '#3a7bd5'; g.beginPath(); g.moveTo(10, 80); g.quadraticCurveTo(60, 60, 100, 85); g.stroke();
    });
  }
  // فانوس ذهبي: إطار وزجاج مضيء ولهب
  function lantern(parent, x, y, z, s, { mat, box, glow }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    const gold = mat(0x9a6b22, { emissive: 0x4a2e08, emissiveIntensity: 0.4 });
    box(0.62, 0.08, 0.62, gold, 0, 0.5, 0, g); box(0.5, 0.08, 0.5, gold, 0, -0.5, 0, g);
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) box(0.05, 1, 0.05, gold, dx, 0, dz, g);
    box(0.46, 0.9, 0.46, mat(0xffe2a6, { emissive: 0xffb04a, emissiveIntensity: 1, transparent: true, opacity: 0.85 }), 0, 0, 0, g);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.35, 4), gold); cone.position.y = 0.72; cone.rotation.y = PI / 4; g.add(cone);
    const gl = glow(0xffb866, 3.2, g); flames.push(gl);
    return g;
  }

  function init(ctx) {
    K = ctx;
    const { scene, HX, mat, mesh, box, glow, canvasTex, texLoader, woodTex } = ctx;
    const Z0 = 6, Z1 = -86, L = Z0 - Z1, ZC = (Z0 + Z1) / 2;

    // 1) الأرضية: رخام لامع يعكس الضوء
    scene.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width === 14 && o.geometry.parameters.height === 92 && Math.abs(o.position.x - HX) < 0.1) {
        if (o.position.y === 0) o.material = new THREE.MeshPhongMaterial({ map: marble(canvasTex), color: 0xc9ad8a, shininess: 90, specular: 0x9a7040 });
        else o.visible = false;                         // السقف المسطّح القديم
      }
    });
    // الجدران: كريمي دافئ مع ألواح خشبية في الأسفل
    const cream = mat(0xf1e3c6);
    scene.traverse((o) => { if (o.isMesh && o.material === mat(0xf3e6cf) && Math.abs(o.position.x - HX) < 8) o.material = cream; });
    const wood = new THREE.MeshLambertMaterial({ map: woodTex(16, 1, '#6b3b22') });
    for (const s of [-1, 1]) {
      box(0.12, 1.3, 92, wood, HX + s * 6.45, 0.65, ZC);
      box(0.18, 0.12, 92, mat(0x4a2716), HX + s * 6.42, 1.32, ZC);
      // الجدران العليا تحت القبة
      const up = mesh(new THREE.PlaneGeometry(92, 3.2), mat(0xe8d6b4, { side: THREE.DoubleSide }), HX + s * 6.99, 8.6, ZC); up.rotation.y = -s * PI / 2;
    }
    // 2) قبّة زرقاء بعوارض خشبية ذهبية
    const vault = mesh(new THREE.CylinderGeometry(7, 7, L, 28, 1, true, -PI / 2, PI), mat(0x2b2f78, { side: THREE.DoubleSide, emissive: 0x141640, emissiveIntensity: 0.6 }), HX, 10.2, ZC);
    vault.rotation.x = -PI / 2; vault.scale.set(1, 1, 0.42);
    for (let z = Z0 - 2; z > Z1; z -= 7) {
      const rib = mesh(new THREE.TorusGeometry(7, 0.16, 6, 28, PI), mat(0x7a4a1e, { emissive: 0x3a2008, emissiveIntensity: 0.4 }), HX, 10.2, z);
      rib.scale.set(1, 0.42, 1);
      for (const s of [-1, 1]) box(0.5, 10.2, 0.5, mat(0xd9c49a), HX + s * 6.7, 5.1, z);   // أعمدة على الجدار
    }
    // 3) الصورة نفسها في نهاية الممر (بنسبتها كاملة، بلا قص) وتوهّج بنفسجي
    const IMG = window.ROOM_IMAGES && window.ROOM_IMAGES.hall;
    if (IMG) {
      const H = 14 * IMG.h / IMG.w;
      const back = mesh(new THREE.PlaneGeometry(14, H), new THREE.MeshBasicMaterial({ map: texLoader.load(IMG.src), fog: false }), HX, 1.1 + H / 2, Z1 + 0.03);
      back.renderOrder = -1;
      mesh(new THREE.PlaneGeometry(14, 3), mat(0x2b2f78, { side: THREE.DoubleSide }), HX, 1.1 + H + 1.4, Z1 + 0.02);
    }
    const endGlow = glow(0xa070ff, 7, scene); endGlow.position.set(HX, 1.2, Z1 + 3);
    // 4) فوانيس معلّقة في الوسط، ومصابيح جدارية بين الأبواب
    scene.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() === 0xffc56b && Math.abs(o.position.x - HX) < 0.1) o.visible = false; });
    for (let z = 0; z > -84; z -= 10) {
      box(0.04, 2.2, 0.04, 0x2a160c, HX, 8.9, z);
      lantern(scene, HX, 7.2, z, 1.1, ctx);
    }
    const free = [-2.5, -15.5, -28.5, -41.5, -54.5, -67.5, -80.5];
    for (const z of free) for (const s of [-1, 1]) {
      lantern(scene, HX + s * 6.1, 4.6, z, 0.55, ctx);
      // رسومات الأطفال في إطارات خشبية
      const k = Math.round(-z) + (s > 0 ? 3 : 0);
      const fr = new THREE.Group(); fr.position.set(HX + s * 6.37, 3.0, z + (s > 0 ? 1.2 : -1.2)); fr.rotation.y = -s * PI / 2; scene.add(fr);
      box(1.5, 1.2, 0.06, 0x7a4a26, 0, 0, 0, fr);
      mesh(new THREE.PlaneGeometry(1.36, 1.06), new THREE.MeshBasicMaterial({ map: drawing(canvasTex, k) }), 0, 0, 0.035, fr);
      // نبتة في أصيص
      const p = new THREE.Group(); p.position.set(HX + s * 5.85, 0, z + (s > 0 ? -1.3 : 1.3)); scene.add(p);
      mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 12), mat(0xe9dcc6), 0, 0.3, 0, p);
      for (let i = 0; i < 7; i++) { const lf = mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(i % 2 ? 0x2f8a3a : 0x3fa64a), Math.cos(i * 0.9) * 0.18, 0.75 + (i % 3) * 0.12, Math.sin(i * 0.9) * 0.18, p); lf.scale.set(1, 1.8, 0.6); lf.rotation.z = Math.cos(i) * 0.6; }
    }
    // 5) أضواء دافئة على طول الممر، وضوء بنفسجي عند النهاية
    for (let z = -4; z > -84; z -= 16) { const l = new THREE.PointLight(0xffb060, 0.55, 18); l.position.set(HX, 5.5, z); scene.add(l); lights.push(l); }
    const pl = new THREE.PointLight(0x9b5cff, 1.1, 26); pl.position.set(HX, 3, Z1 + 4); scene.add(pl); lights.push(pl);

    // 6) أبواب خشبية كما في الصورة، بزجاج ملوّن بلون الغرفة؛ والخزائن الملوّنة صارت خشبية
    const doorWood = new THREE.MeshLambertMaterial({ map: woodTex(1, 3, '#5a2f17') });
    const frameWood = mat(0x3a1f12);
    (ctx.hall.doors || []).forEach((d) => {
      d.leaf.material = doorWood;
      d.g.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'BoxGeometry' && c.geometry.parameters.width === 3.6) c.material = frameWood; });
      const col = new THREE.Color(d.room.color).getHex();
      for (const dx of [-0.65, 0.65]) box(0.9, 1.3, 0.04, mat(col, { emissive: col, emissiveIntensity: 0.7 }), dx, 3.1, 0.27, d.g);   // زجاج ملوّن
      box(0.06, 4, 0.05, frameWood, 0, 2, 0.27, d.g);                                                                                // بين الدفّتين
    });
    scene.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry' || Math.abs(o.position.x - HX) > 7) return;
      const p = o.geometry.parameters;
      if (p.width === 0.6 && p.height === 2.6 && p.depth === 1.6) o.material = wood;   // خزانة
      if (p.width === 0.05 && p.height === 2.3) o.visible = false;                     // شريط الخزانة الأبيض
    });

    // وميض خفيف للهب الفوانيس
    let t = 0, prev = performance.now();
    (function anim(now) {
      requestAnimationFrame(anim);
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; t += dt;
      if (K.G.area !== 'hall') return;
      flames.forEach((f, i) => { const k = 1 + Math.sin(t * 7 + i * 1.7) * 0.06 + Math.sin(t * 13 + i) * 0.03; f.scale.set(3.2 * k, 3.2 * k, 1); });
      endGlow.material.opacity = 0.5 + Math.sin(t * 1.6) * 0.15;
    })(prev);
  }
  // ألوان الجو داخل الممر: مساء دافئ
  function area(a) {
    if (!K) return;
    lights.forEach((l) => { l.visible = a === 'hall'; });
    if (a === 'hall') {
      K.scene.background = new THREE.Color(0x1d1640); K.scene.fog = new THREE.Fog(0x2a1d4a, 45, 120);
      K.hemi.intensity = 0.42; K.sun.intensity = 0.18;   // مساء دافئ: الضوء من الفوانيس لا من السماء
    }
  }
  window.HALL_LOOK = { init, area };
})();
