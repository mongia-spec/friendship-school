// أماكن ثلاثية الأبعاد حقيقية بدل الصور المسطحة: نهاية الممر، والجدار الخلفي للمكتبة، وواجهة المدرسة.
// يضبط window.PLACES3D فتتوقف ملفات *-look.js عن وضع الصور، ثم يبني game.js هذه المجسمات.
(() => {
  window.PLACES3D = true;
  const PI = Math.PI;
  const cache = {};
  let S = null;
  const lam = (key, o) => cache[key] || (cache[key] = new THREE.MeshLambertMaterial(o));
  const phong = (key, o) => cache[key] || (cache[key] = new THREE.MeshPhongMaterial(o));
  function add(geo, m, x, y, z, p) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); (p || S).add(o); return o; }
  const B = (w, h, d, m, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
  const C = (rt, rb, h, m, x, y, z, p, seg = 16) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p);
  function tex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t;
  }
  // قوس مدبّب (إسلامي) كشكل ثنائي الأبعاد
  function archShape(w, h, spring) {
    const s = new THREE.Shape(), hw = w / 2;
    s.moveTo(-hw, 0); s.lineTo(-hw, spring);
    s.quadraticCurveTo(-hw, h - (h - spring) * 0.15, 0, h);
    s.quadraticCurveTo(hw, h - (h - spring) * 0.15, hw, spring);
    s.lineTo(hw, 0); s.lineTo(-hw, 0);
    return s;
  }
  function archFrame(w, h, spring, t, depth, m, x, y, z, p) {   // إطار قوس بسماكة
    const outer = archShape(w + 2 * t, h + t, spring), inner = archShape(w, h, spring);
    outer.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
    const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 20 });
    return add(g, m, x, y, z, p);
  }
  function archFill(w, h, spring, m, x, y, z, p) { return add(new THREE.ShapeGeometry(archShape(w, h, spring), 20), m, x, y, z, p); }

  const mosaicTex = () => cache.mos || (cache.mos = tex(128, 64, (g, w, h) => {
    g.fillStyle = '#1d3f8f'; g.fillRect(0, 0, w, h);
    for (const cx of [32, 96]) {
      g.fillStyle = '#f3e6cf'; g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = i % 2 ? 13 : 26; g.lineTo(cx + Math.cos(a) * r, 32 + Math.sin(a) * r); }
      g.fill(); g.fillStyle = '#2fb6b0'; g.beginPath(); g.arc(cx, 32, 7, 0, PI * 2); g.fill();
    }
    g.fillStyle = '#d4a64a'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  }, [8, 1]));
  const lattice = () => cache.lat || (cache.lat = tex(128, 128, (g, w) => {   // مشربية
    g.fillStyle = '#4a2716'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#ffd99a';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 32 + 16, cy = y * 32 + 16; g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = i % 2 ? 6 : 12; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.fill();
    }
  }, [2, 4]));
  const stained = () => cache.st || (cache.st = tex(256, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d1a80'); gr.addColorStop(1, '#1d3f8f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cols = ['#ffd27a', '#2fb6b0', '#e84d8a', '#8e5cf7', '#7cb342'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) { g.fillStyle = cols[(x + y * 2) % 5]; g.globalAlpha = 0.85; g.beginPath(); g.arc(x * 52 + 24 + (y % 2) * 26, y * 48 + 24, 17, 0, PI * 2); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = '#1a1030'; g.lineWidth = 5; for (let x = 0; x < w; x += 52) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }));
  const carved = (base) => cache['cv' + base] || (cache['cv' + base] = tex(128, 256, (g, w, h) => {   // باب خشبي منقوش
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6;
    for (const [y0, y1] of [[14, 110], [130, 242]]) g.strokeRect(14, y0, w - 28, y1 - y0);
    g.fillStyle = 'rgba(255,210,122,.55)';
    for (const cy of [62, 186]) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = i % 2 ? 12 : 26; g.lineTo(64 + Math.cos(a) * r, cy + Math.sin(a) * r); } g.fill(); }
    g.fillStyle = '#d4a64a'; g.beginPath(); g.arc(w - 22, h / 2, 6, 0, PI * 2); g.fill();
  }));

  function lantern(x, y, z, s, glow, p) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); (p || S).add(g);
    const gold = phong('lgold', { color: 0xc8962e, shininess: 80, specular: 0xffe7a0 });
    B(0.62, 0.08, 0.62, gold, 0, 0.5, 0, g); B(0.5, 0.08, 0.5, gold, 0, -0.5, 0, g);
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) B(0.05, 1, 0.05, gold, dx, 0, dz, g);
    B(0.46, 0.9, 0.46, lam('lglass', { color: 0xffe2a6, emissive: 0xffb04a, emissiveIntensity: 1, transparent: true, opacity: 0.85 }), 0, 0, 0, g);
    const cone = add(new THREE.ConeGeometry(0.42, 0.35, 4), gold, 0, 0.72, 0, g); cone.rotation.y = PI / 4;
    glow(0xffb866, 3, g);
    return g;
  }
  function books(n, place) {   // كتب كثيرة بمجسّم واحد (InstancedMesh) لأداء جيد
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
    const cols = [0x8e2a2a, 0x1f4e79, 0x2e6b3a, 0x5a2d82, 0xb5651d, 0xc8962e, 0x3d1a80, 0xa83a5a];
    let k = 0;
    place((x, y, z, w, h, d, tilt) => {
      if (k >= n) return;
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt || 0);
      m.compose(ps.set(x, y, z), q, sc.set(w, h, d)); im.setMatrixAt(k, m); im.setColorAt(k, col.setHex(cols[(k * 5 + (k >> 3)) % cols.length])); k++;
    });
    im.count = k; S.add(im); return im;
  }
  function shelfWall(x0, x1, y0, y1, z, rows, dir) {   // رفوف كتب مليئة على جدار (dir: اتجاه الواجهة على z)
    const wd = lam('shelfw', { color: 0x5a3018 });
    const W = x1 - x0, H = y1 - y0, cx = (x0 + x1) / 2;
    B(W, H, 0.1, lam('shelfback', { color: 0x3a1f10 }), cx, y0 + H / 2, z);
    for (let r = 0; r <= rows; r++) B(W + 0.2, 0.12, 0.9, wd, cx, y0 + r * H / rows, z + dir * 0.45);
    const cols = Math.max(2, Math.round(W / 2.4));
    for (let c = 0; c <= cols; c++) B(0.14, H, 0.92, wd, x0 + c * W / cols, y0 + H / 2, z + dir * 0.45);
    return books(Math.ceil(W / 0.13) * rows, (put) => {
      for (let r = 0; r < rows; r++) {
        const by = y0 + r * H / rows + 0.06, maxH = H / rows - 0.2;
        let bx = x0 + 0.15;
        while (bx < x1 - 0.2) {
          if (Math.abs(((bx - x0) % (W / cols))) < 0.12) { bx += 0.14; continue; }
          const bw = 0.08 + Math.random() * 0.09, bh = maxH * (0.62 + Math.random() * 0.36);
          const tilt = Math.random() < 0.05 ? 0.22 : 0;
          put(bx + bw / 2, by + bh / 2, z + dir * (0.42 + Math.random() * 0.06), bw, bh, 0.6, tilt);
          bx += bw + 0.012;
        }
      }
    });
  }

  /* ---------- 1) نهاية الممر: بوابة بقوس مدبب وباب منقوش ومشربيات ---------- */
  function hall(ctx) {
    S = ctx.scene; const { HX, glow } = ctx; const Z = -85.95;
    const wallM = lam('hallend', { color: 0xf1e3c6 });
    // الجدار العلوي تحت القبة (نصف قطع ناقص) حتى لا يظهر الفراغ
    { const sh = new THREE.Shape(); sh.moveTo(-7, 0); sh.absellipse(0, 0, 7, 3, PI, 0, true); sh.lineTo(-7, 0);
      const up = add(new THREE.ShapeGeometry(sh, 24), lam('hallvault', { color: 0x2b2f78, emissive: 0x141640, emissiveIntensity: 0.6 }), HX, 10.2, Z); up.position.z = Z; }
    add(new THREE.PlaneGeometry(14, 3.2), wallM, HX, 8.6, Z);
    // البوابة
    const gold = phong('hgold', { color: 0xd4a64a, shininess: 90, specular: 0xffe7a0 });
    archFrame(4.4, 6.2, 4.2, 0.45, 0.5, gold, HX, 0, Z);
    archFrame(5.6, 7.2, 4.8, 0.5, 0.3, lam('hmos', { map: mosaicTex() }), HX, 0, Z);
    for (const s of [-1, 1]) {
      const leaf = B(2.15, 4.2, 0.18, lam('hdoor', { map: carved('#6a2f14') }), HX + s * 1.1, 2.1, Z + 0.15);
      B(0.12, 0.5, 0.12, gold, HX + s * 0.35, 2.2, Z + 0.3);
    }
    archFill(4.4, 6.2, 4.2, lam('hst', { map: stained(), emissive: 0x6040c0, emissiveIntensity: 0.45 }), HX, 4.2, Z + 0.06).scale.set(1, 1, 1);
    // مشربيتان على الجانبين وفوانيس وأعمدة
    for (const s of [-1, 1]) {
      archFill(2.4, 3.6, 2.6, lam('hlat', { map: lattice(), emissive: 0x6a4a20, emissiveIntensity: 0.5 }), HX + s * 4.6, 1.6, Z + 0.05);
      archFrame(2.4, 3.6, 2.6, 0.2, 0.25, gold, HX + s * 4.6, 1.6, Z);
      C(0.32, 0.38, 7, lam('hcol', { color: 0xd9c49a }), HX + s * 3.2, 3.5, Z + 0.4, null, 14);
      B(0.9, 0.4, 0.9, gold, HX + s * 3.2, 7, Z + 0.4);
      lantern(HX + s * 4.6, 6.2, Z + 0.6, 0.8, glow);
      const pot = C(0.55, 0.4, 0.9, lam('hpot', { color: 0x1d3f8f }), HX + s * 6, 0.45, Z + 1.2, null, 14);
      for (let k = 0; k < 7; k++) { const l = add(new THREE.SphereGeometry(0.4, 8, 6), lam('hleaf', { color: 0x3f8f3a }), HX + s * 6 + Math.cos(k * 2.4) * 0.3, 1.3 + (k % 3) * 0.35, Z + 1.2 + Math.sin(k * 2.4) * 0.3); l.scale.set(0.55, 1.3, 0.3); l.rotation.set(Math.sin(k), k * 2.4, Math.cos(k)); }
    }
    B(14, 0.9, 0.3, lam('hmos2', { map: mosaicTex() }), HX, 7.6, Z + 0.1);
    glow(0xa070ff, 6, S).position.set(HX, 2.4, Z + 0.8);
  }

  /* ---------- 2) الجدار الخلفي للمكتبة: رفوف كتب بطابقين وشرفة ونافذة زجاج ملون ---------- */
  function library(ctx) {
    S = ctx.scene; const { LX, glow } = ctx; const Z = -31.9, BH = 15.75;
    add(new THREE.PlaneGeometry(28, BH), lam('libback', { color: 0x3a1f10 }), LX, BH / 2, Z - 0.02);
    // الطابق السفلي: رفوف على جانبي الباب البنفسجي
    shelfWall(LX - 13.6, LX - 3.2, 0, 6.8, Z, 6, 1);
    shelfWall(LX + 3.2, LX + 13.6, 0, 6.8, Z, 6, 1);
    // شرفة خشبية بدرابزين
    const wd = lam('libbal', { color: 0x6b3b22 });
    B(28, 0.35, 2.2, wd, LX, 7.4, Z + 1.1);
    B(28, 0.18, 0.12, phong('libgold', { color: 0xc8962e, shininess: 70 }), LX, 8.5, Z + 2.15);
    for (let x = -13.6; x <= 13.6; x += 0.7) C(0.05, 0.06, 1, wd, LX + x, 8, Z + 2.15, null, 6);
    for (const s of [-1, 1]) for (const xx of [6, 13]) { const k = B(0.5, 0.9, 0.5, wd, LX + s * xx, 6.9, Z + 1.9); }
    // الطابق العلوي: رفوف ونافذة مقوسة بزجاج ملوّن في الوسط
    shelfWall(LX - 13.6, LX - 3.6, 7.6, 14.2, Z, 5, 1);
    shelfWall(LX + 3.6, LX + 13.6, 7.6, 14.2, Z, 5, 1);
    archFill(5.6, 6.4, 4, lam('libst', { map: stained(), emissive: 0x7050d0, emissiveIntensity: 0.7 }), LX, 7.7, Z + 0.03);
    archFrame(5.6, 6.4, 4, 0.35, 0.4, phong('libgold', {}), LX, 7.7, Z);
    glow(0x9b7cff, 7, S).position.set(LX, 11, Z + 0.6);
    // سلّم المكتبة الخشبي وكرة أرضية
    const lad = new THREE.Group(); lad.position.set(LX - 9, 0, Z + 1.3); lad.rotation.x = -0.18; S.add(lad);
    for (const s of [-1, 1]) B(0.1, 7.4, 0.1, wd, s * 0.45, 3.7, 0, lad);
    for (let k = 0; k < 12; k++) B(0.9, 0.07, 0.08, wd, 0, 0.4 + k * 0.6, 0, lad);
    const globe = new THREE.Group(); globe.position.set(LX + 9.5, 0, Z + 3); S.add(globe);
    C(0.35, 0.5, 0.12, wd, 0, 0.06, 0, globe); C(0.05, 0.05, 1, wd, 0, 0.6, 0, globe, 6);
    add(new THREE.SphereGeometry(0.55, 20, 14), lam('globe', { map: tex(128, 64, (g, w, h) => { g.fillStyle = '#3a7bd5'; g.fillRect(0, 0, w, h); g.fillStyle = '#7cb342'; for (const [x, y, r] of [[30, 22, 12], [70, 30, 16], [100, 20, 9], [52, 44, 8]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, PI * 2); g.fill(); } }) }), 0, 1.55, 0, globe);
    add(new THREE.TorusGeometry(0.62, 0.03, 6, 24, PI), phong('libgold', {}), 0, 1.55, 0, globe).rotation.y = PI / 2;
    if (ctx.addCol) ctx.addCol(LX + 9, LX + 10, Z + 2.5, Z + 3.5);
  }

  /* ---------- 3) واجهة المدرسة في الساحة: قوس مدبب حول الباب، وأقواس فوق النوافذ، وفوانيس ---------- */
  function yard(ctx) {
    S = ctx.scene; const { glow } = ctx;
    const gold = phong('ygold', { color: 0xd4a64a, shininess: 90, specular: 0xffe7a0 });
    archFrame(5.4, 7.6, 5.2, 0.45, 0.4, gold, 0, 0, -22.95);
    archFrame(6.3, 8.4, 5.6, 0.55, 0.3, lam('ymos', { map: mosaicTex() }), 0, 0, -23.05);
    archFill(5.4, 7.6, 5.2, lam('yst', { map: stained(), emissive: 0x7050d0, emissiveIntensity: 0.6 }), 0, 0, -23.08);
    for (const s of [-1, 1]) {
      lantern(s * 4.1, 4.6, -22.4, 0.75, glow);
    }
    for (let xx = -31; xx <= 31; xx += 4.5) {
      if (Math.abs(xx) < 12) continue;
      {
        for (const y of [3.5, 8.8]) {
          archFrame(2.2, 3.5, 2.6, 0.22, 0.3, gold, xx, y - 1.5, -23.85);
          archFill(2.2, 3.5, 2.6, lam('ylat', { map: lattice(), emissive: 0x8a5a20, emissiveIntensity: 0.7 }), xx, y - 1.5, -23.78);
        }
      }
    }
  }

  window.PLACES3D_BUILD = { hall, library, yard };
})();
