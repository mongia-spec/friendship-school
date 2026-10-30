// ساحة المدرسة بأسلوب صورة الأستاذة منجية (assets/rooms/yard.webp):
// مساء سحري بسماء بنفسجية وردية برتقالية، رخام لامع يعكس الأضواء بمعيّنات زرقاء،
// أشرطة فسيفساء زرقاء على الواجهة، باب خشبي منقوش، زهور معلّقة، فوانيس دافئة، ونافورة بفسيفساء وماء بنفسجي.
// الساحة تبقى مجسّمة ليمشي فيها البطل؛ والصورة نفسها تظهر كاملة بنسبتها في شاشة التحميل.
// يُحمَّل قبل game.js، وgame.js يستدعي YARD_LOOK.init بعد بناء العالم، وYARD_LOOK.area عند تغيير المكان.
(() => {
  const PI = Math.PI;
  let K = null, sky = null, lights = [];

  // سماء الغروب: أزرق بنفسجي في الأعلى، ثم وردي، ثم برتقالي عند الأفق، مع نجوم أولى
  function skyTex(canvasTex) {
    return canvasTex(64, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2a2a7a'); gr.addColorStop(0.35, '#6b3fa0'); gr.addColorStop(0.6, '#d9609a'); gr.addColorStop(0.8, '#f59a6a'); gr.addColorStop(1, '#ffc37a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.8)';
      for (let k = 0; k < 18; k++) g.fillRect((k * 23) % w, (k * 37) % (h * 0.3), 1, 1);
    });
  }
  function marble(canvasTex) {
    return canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#f0e2cc'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(160,130,100,.22)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { g.beginPath(); let x = (k * 97) % w, y = 0; g.moveTo(x, y); while (y < w) { x += ((k * 13 + y) % 50) - 25; y += 35; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#1f2a6b';
      g.beginPath(); g.moveTo(w / 2, w * 0.4); g.lineTo(w * 0.62, w / 2); g.lineTo(w / 2, w * 0.6); g.lineTo(w * 0.38, w / 2); g.fill();
      g.strokeStyle = 'rgba(31,42,107,.55)'; g.lineWidth = 6; g.strokeRect(0, 0, w, w);
    }, [20, 16]);
  }
  // فسيفساء: نجوم ثمانية زرقاء وفيروزية على أرضية كريمية
  function mosaic(canvasTex, rx, ry) {
    return canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#1d3f8f'; g.fillRect(0, 0, w, h);
      for (const cx of [32, 96]) {
        g.fillStyle = '#f3e6cf'; g.beginPath();
        for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = i % 2 ? 13 : 26; g.lineTo(cx + Math.cos(a) * r, 32 + Math.sin(a) * r); }
        g.fill();
        g.fillStyle = '#2fb6b0'; g.beginPath(); g.arc(cx, 32, 7, 0, PI * 2); g.fill();
      }
      g.fillStyle = '#d4a64a'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    }, [rx, ry]);
  }
  // نافذة دائرية بزجاج ملوّن (مثل نافذة الصورة فوق الباب)
  function rose(canvasTex) {
    return canvasTex(256, 256, (g) => {
      g.fillStyle = '#e9dcc6'; g.beginPath(); g.arc(128, 128, 126, 0, PI * 2); g.fill();
      g.fillStyle = '#1d3f8f'; g.beginPath(); g.arc(128, 128, 112, 0, PI * 2); g.fill();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI * 2;
        g.fillStyle = i % 2 ? '#2fb6b0' : '#7a5cd6';
        g.beginPath(); g.ellipse(128 + Math.cos(a) * 58, 128 + Math.sin(a) * 58, 34, 18, a, 0, PI * 2); g.fill();
      }
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(128, 128, 26, 0, PI * 2); g.fill();
    });
  }

  function init(ctx) {
    K = ctx;
    const { scene, yard, mat, mesh, box, glow, canvasTex, woodTex } = ctx;
    sky = skyTex(canvasTex);

    // 1) الرخام اللامع (أرضية الساحة 70×56)
    scene.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width === 70 && o.geometry.parameters.height === 56) {
        o.material = new THREE.MeshPhongMaterial({ map: marble(canvasTex), color: 0xfff0dc, shininess: 110, specular: 0xc09060 });
      }
    });
    // 2) الواجهة: أشرطة فسيفساء زرقاء، ونافذة دائرية، وباب خشبي منقوش
    const band = new THREE.MeshLambertMaterial({ map: mosaic(canvasTex, 30, 1), emissive: 0x0a1430, emissiveIntensity: 0.4 });
    box(66, 1.2, 0.3, band, 0, 12.1, -23.9);
    box(66, 0.8, 0.3, band, 0, 6.4, -23.85);
    box(22, 1.2, 0.3, new THREE.MeshLambertMaterial({ map: mosaic(canvasTex, 10, 1) }), 0, 16.4, -23.35);
    const rw = mesh(new THREE.CircleGeometry(1.9, 40), new THREE.MeshBasicMaterial({ map: rose(canvasTex) }), 7.2, 14.6, -23.05);
    const rw2 = mesh(new THREE.CircleGeometry(1.9, 40), new THREE.MeshBasicMaterial({ map: rose(canvasTex) }), -7.2, 14.6, -23.05);
    [rw, rw2].forEach((r) => glow(0x8a7cff, 5, scene).position.copy(r.position).setZ(-22.8));
    const door = yard.doors[0];
    if (door && door.leaf) {
      door.leaf.material = new THREE.MeshLambertMaterial({ map: woodTex(1, 3, '#5a2a14') });
      for (const dx of [-1, 1]) for (const dy of [1.6, 3.9]) box(1.5, 1.6, 0.05, mat(0x3e1a0b), dx * 1.0, dy, 0.42, door.grp);   // نقوش الباب
      box(5.4, 0.5, 0.7, band, 0, 6.6, 0, door.grp);
    }
    // 3) زهور معلّقة وردية وبنفسجية على امتداد الطابق الأرضي (مثل الجهنّميّة في الصورة)
    const petals = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshLambertMaterial(), 520);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    const cols = [0xe0408a, 0xc23aa8, 0xff7ab6, 0x9a5cf0, 0xffffff];
    for (let k = 0; k < 520; k++) {
      const x = -32 + (k / 520) * 64; if (Math.abs(x) < 11.5 && k % 3) continue;
      const y = 6.9 + Math.sin(k * 1.7) * 0.35 - Math.abs(Math.sin(x * 0.7)) * 0.9;
      m4.makeTranslation(x, y, -23.4 + Math.sin(k) * 0.25);
      petals.setMatrixAt(k, m4); petals.setColorAt(k, col.setHex(cols[k % 5]));
    }
    scene.add(petals);
    // 4) النافورة: حافة بفسيفساء زرقاء، وماء بنفسجي مضيء، ونوافير رفيعة
    const ring = mesh(new THREE.CylinderGeometry(4.55, 4.55, 0.5, 40, 1, true), new THREE.MeshLambertMaterial({ map: mosaic(canvasTex, 12, 1), side: THREE.DoubleSide }), 0, 0.45, 12);
    if (yard.water) { yard.water.material.color.setHex(0x8a6cff); yard.water.material.opacity = 0.9; }
    const jetMat = new THREE.MeshBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.45 });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2;
      const j = mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.6, 6), jetMat, Math.cos(a) * 1.7, 1.6, 12 + Math.sin(a) * 1.7);
      j.rotation.z = Math.cos(a) * 0.35; j.rotation.x = -Math.sin(a) * 0.35;
    }
    glow(0x9b7cff, 9, scene).position.set(0, 1.4, 12);
    // 5) أضواء المساء: فوانيس أدفأ، وضوء بنفسجي عند الباب والنافورة
    for (const [x, z] of [[-9, 16], [9, 16], [-9, 0], [9, 0], [-9, -16], [9, -16]]) { const l = new THREE.PointLight(0xffaa55, 0.55, 14); l.position.set(x, 3.6, z); scene.add(l); lights.push(l); }
    for (const p of [[0, 3, -20], [0, 2, 12]]) { const l = new THREE.PointLight(0x9b5cff, 0.9, 18); l.position.set(...p); scene.add(l); lights.push(l); }
    // 6) صورة الساحة نفسها واجهةً للمدرسة (بطلب الأستاذة منجية): الصورة كاملة بنسبتها،
    //    وخط أرضها عند عتبة الباب فيقف الباب على أرض الساحة؛ وأرضيتها ونافورتها تحت أرض اللعبة.
    const IMG = ctx.yardImg;
    if (IMG) {
      const W = 44, H = W * IMG.h / IMG.w, GROUND = 535 / IMG.h;     // عتبة الباب في الصورة
      const bottom = -(1 - GROUND) * H;
      const face = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: ctx.texLoader.load(IMG.src), fog: false }), 0, bottom + H / 2, -23.0);
      face.renderOrder = -1;
      // ما كان أمام الواجهة في وسطها يختفي حتى لا يغطي الصورة: الباب المجسّم والأعمدة والنافذتان الدائريتان
      if (door) door.grp.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'BoxGeometry') c.visible = false; });
      if (door && door.glow) { door.glow.scale.multiplyScalar(0.45); door.glow.position.y = 1.2; }   // الصورة فيها توهّج الباب أصلًا
      [rw, rw2].forEach((r) => { r.visible = false; });
      petals.visible = false;   // الزهور في الصورة نفسها
      scene.traverse((o) => {
        if (o.isSprite && Math.abs(o.position.z + 22.8) < 0.01) o.visible = false;                                                // توهّج النافذتين
        if (o.isMesh && o.geometry.type === 'CylinderGeometry' && Math.abs(o.position.z + 23.1) < 0.01 && Math.abs(o.position.x) < 22) o.visible = false;   // الأعمدة
      });
      // لا يمشي البطل داخل الصورة؛ الباب في وسطها مفتوح
      ctx.addCol(-22, -2.2, -23.6, -22.85); ctx.addCol(2.2, 22, -23.6, -22.85);
    }
    // سحب وردية دافئة
    yard.clouds.forEach((c) => c.children.forEach((s) => { s.material = mat(0xffc2d6, { emissive: 0xff9ec2, emissiveIntensity: 0.55 }); }));
  }
  function area(a) {
    if (!K) return;
    lights.forEach((l) => { l.visible = a === 'yard'; });
    if (a === 'yard') {
      K.scene.background = sky; K.scene.fog = new THREE.Fog(0xd98aa8, 60, 150);
      K.hemi.intensity = 0.55; K.sun.intensity = 0.42; K.sun.color.setHex(0xffb27a);
    } else K.sun.color.setHex(0xfff2d6);
  }
  window.YARD_LOOK = { init, area };
})();
