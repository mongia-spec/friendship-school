// غرف ثلاثية الأبعاد حقيقية بدل الصور المسطحة: أرضية خشبية، وجدران بألواح وورق جدران، ونوافذ،
// وسقف بمصابيح، وأثاث مجسّم كامل لكل غرفة حسب موضوعها. يُستدعى من buildRoom في game.js.
// مواضع اللعب محجوزة ولا يوضع فيها أثاث: الوحش (x+5.5, z-5.5)، القفص (x-7, z-5.5)،
// بلاطات الإجابة (z+3.6)، وممر الدخول من الباب (z+9.6).
(() => {
  const PI = Math.PI;
  const texCache = {}, matCache = {};
  let K = null;

  /* ---------- أدوات صغيرة ---------- */
  function tex(key, w, h, draw, rep) {
    const k = key + (rep ? rep.join('x') : '');
    if (texCache[k]) return texCache[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.anisotropy = 4;
    return (texCache[k] = t);
  }
  function M(key, opts) {
    if (matCache[key]) return matCache[key];
    const o = Object.assign({}, opts); const ph = o.phong; delete o.phong;
    const m = ph ? new THREE.MeshPhongMaterial(o) : new THREE.MeshLambertMaterial(o);
    return (matCache[key] = m);
  }
  const col = (c) => new THREE.Color(c);
  const shade = (hex, k) => { const c = col(hex); return k > 0 ? c.lerp(col(0xffffff), k).getHex() : c.lerp(col(0x000000), -k).getHex(); };
  const hexStr = (h) => '#' + col(h).getHexString();

  function add(geo, material, x, y, z, parent) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); (parent || K.scene).add(m); return m;
  }
  const B = (w, h, d, m, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
  const C = (rt, rb, h, m, x, y, z, p, seg = 16) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p);
  const S = (r, m, x, y, z, p, seg = 16) => add(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), m, x, y, z, p);
  // صندوق بحواف مدوّرة (للأثاث الناعم)
  function RB(w, h, d, r, m, x, y, z, p) {
    const s = new THREE.Shape(), hw = w / 2 - r, hh = h / 2 - r;
    s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh); s.lineTo(w / 2, hh); s.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
    s.lineTo(-hw, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); s.lineTo(-w / 2, -hh); s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return add(g, m, x, y, z, p);
  }

  /* ---------- نسيج مرسوم ---------- */
  const woodFloorTex = (tint) => tex('floor' + tint, 512, 512, (g, w) => {
    const base = col(tint);
    for (let row = 0; row < 8; row++) for (let k = 0; k < 4; k++) {
      const c = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      g.fillStyle = '#' + c.getHexString();
      const off = (row % 2) * 64;
      g.fillRect(k * 128 + off - 128, row * 64, 128, 64); g.fillRect(k * 128 + off, row * 64, 128, 64);
      g.strokeStyle = 'rgba(60,30,10,.35)'; g.lineWidth = 2; g.strokeRect(k * 128 + off, row * 64, 128, 64);
      g.strokeStyle = 'rgba(80,40,15,.12)'; g.lineWidth = 1;
      for (let l = 0; l < 5; l++) { g.beginPath(); const yy = row * 64 + 8 + l * 11 + Math.random() * 4; g.moveTo(k * 128 + off, yy); g.bezierCurveTo(k * 128 + off + 40, yy + 3, k * 128 + off + 80, yy - 3, k * 128 + off + 128, yy); g.stroke(); }
    }
  }, [4, 4]);
  const wallpaperTex = (hex) => tex('wp' + hex, 256, 256, (g, w) => {
    g.fillStyle = hexStr(shade(hex, 0.82)); g.fillRect(0, 0, w, w);
    g.fillStyle = hexStr(shade(hex, 0.7));
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + (y % 2) * 32 + 16, cy = y * 64 + 32;
      g.save(); g.translate(cx, cy); g.rotate(PI / 4); g.fillRect(-7, -7, 14, 14); g.restore();
      g.beginPath(); g.arc(cx + 32, cy, 3, 0, PI * 2); g.fill();
    }
  }, [6, 2]);
  const panelTex = (hex) => tex('pn' + hex, 256, 128, (g, w, h) => {
    g.fillStyle = hexStr(shade(hex, -0.15)); g.fillRect(0, 0, w, h);
    g.strokeStyle = hexStr(shade(hex, -0.35)); g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = hexStr(shade(hex, 0.25)); g.lineWidth = 2; g.strokeRect(20, 20, w - 40, h - 40);
  }, [8, 1]);
  const rugTex = (hex) => tex('rug' + hex, 512, 512, (g, w) => {
    g.fillStyle = hexStr(shade(hex, -0.2)); g.fillRect(0, 0, w, w);
    g.fillStyle = '#f6e7c8'; g.fillRect(24, 24, w - 48, w - 48);
    g.fillStyle = hexStr(hex); g.fillRect(44, 44, w - 88, w - 88);
    g.strokeStyle = '#f6e7c8'; g.lineWidth = 6;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w / 2, w / 2, 40 + i * 30, 0, PI * 2); g.stroke(); }
    g.fillStyle = '#f6d27a';
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 200, w / 2 + Math.sin(a) * 200, 9, 0, PI * 2); g.fill(); }
  });
  const stoneTex = tex('stone', 256, 256, (g, w) => {
    g.fillStyle = '#5b4f6e'; g.fillRect(0, 0, w, w);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) {
      const off = (r % 2) * 32; const c = col(0x6e6385).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(k * 64 + off + 2, r * 32 + 2, 60, 28);
    }
  }, [6, 3]);
  const curtainTex = tex('curtain', 128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#7a0f14' : '#c62828');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6d27a'; g.fillRect(0, h - 10, w, 10);
  });
  const glassTex = tex('glass', 128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(0.7, '#e9f7ff'); gr.addColorStop(1, '#a9d98b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(40, 60, 26, 10, 0, 0, PI * 2); g.ellipse(70, 54, 22, 9, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#7cb342'; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.3, h * 0.78, w * 0.6, h * 0.86); g.quadraticCurveTo(w * 0.85, h * 0.8, w, h * 0.84); g.lineTo(w, h); g.fill();
  });
  const paperTex = tex('paper', 128, 160, (g, w, h) => {
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9fb3d1'; g.lineWidth = 2; for (let y = 24; y < h; y += 14) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); }
    g.strokeStyle = '#e8504a'; g.beginPath(); g.moveTo(22, 0); g.lineTo(22, h); g.stroke();
  });
  const letterTex = (ch, bg) => tex('l' + ch + bg, 128, 128, (g, w) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, w - 8);
    g.fillStyle = '#fff'; g.font = 'bold 84px Tajawal, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, w / 2 + 6);
  });
  const clockTex = tex('clock', 256, 256, (g, w) => {
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(128, 128, 124, 0, PI * 2); g.fill();
    g.strokeStyle = '#2a2a3a'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#2a2a3a'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; g.fillRect(128 + Math.cos(a) * 100 - 5, 128 + Math.sin(a) * 100 - 5, 10, 10); }
    g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.moveTo(128, 128); g.lineTo(180, 140); g.stroke();
  });

  /* ---------- مواد مشتركة ---------- */
  const wood = () => M('wood', { map: K.woodTex ? K.woodTex(1, 1, '#9c6a3c') : null, color: 0xffffff });
  const darkWood = () => M('dwood', { color: 0x6b4226 });
  const metal = () => M('metal', { phong: true, color: 0x9aa3ad, shininess: 90, specular: 0x666666 });
  const white = () => M('white', { color: 0xfbf7ef });
  const gold = () => M('gold', { phong: true, color: 0xd4a64a, shininess: 80, specular: 0xffe7a0 });

  /* ---------- قطع أثاث ---------- */
  function chair(x, z, ry, tint) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; K.scene.add(g);
    const seat = M('seat' + tint, { color: tint });
    RB(0.9, 0.12, 0.9, 0.04, seat, 0, 0.92, 0, g);
    RB(0.9, 0.8, 0.1, 0.04, seat, 0, 1.4, -0.42, g);
    for (const [dx, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) C(0.04, 0.04, 0.9, metal(), dx, 0.45, dz, g, 8);
    return g;
  }
  function desk(x, z, w = 1.8, opts = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = opts.ry || 0; K.scene.add(g);
    RB(w, 0.1, 1, 0.03, wood(), 0, 1.15, 0, g);
    for (const [dx, dz] of [[-w / 2 + 0.12, -0.38], [w / 2 - 0.12, -0.38], [-w / 2 + 0.12, 0.38], [w / 2 - 0.12, 0.38]]) C(0.05, 0.05, 1.15, metal(), dx, 0.57, dz, g, 8);
    B(w - 0.2, 0.3, 0.05, darkWood(), 0, 0.95, -0.4, g);
    if (opts.papers !== false) {
      const p = B(0.5, 0.01, 0.65, M('paperm', { map: paperTex }), -0.2 + Math.random() * 0.4, 1.21, 0, g); p.rotation.y = (Math.random() - 0.5) * 0.6;
      const pen = C(0.025, 0.025, 0.5, M('pen' + (opts.pen || 0), { color: opts.pen || 0x3a7bd5 }), 0.35, 1.23, 0.1, g, 6); pen.rotation.z = PI / 2; pen.rotation.y = 0.5;
    }
    if (opts.chair !== false) g.add(chair(0, 0.85, PI, opts.chairTint || 0x3a7bd5));
    if (!opts.noCol) {
      const cs = Math.cos(opts.ry || 0), hw = Math.abs(cs) > 0.5 ? w / 2 : 0.5, hd = Math.abs(cs) > 0.5 ? 0.5 : w / 2;
      K.addCol(x - hw, x + hw, z - hd, z + hd);
    }
    return g;
  }
  function bookshelf(x, z, w, h, ry, books = true) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; K.scene.add(g);
    const dw = darkWood();
    B(w, h, 0.08, dw, 0, h / 2, -0.4, g);
    for (const s of [-1, 1]) B(0.1, h, 0.9, dw, s * (w / 2 - 0.05), h / 2, 0, g);
    const shelves = Math.max(2, Math.round(h / 0.9));
    for (let k = 0; k <= shelves; k++) B(w, 0.08, 0.9, dw, 0, k * (h - 0.08) / shelves + 0.04, 0, g);
    if (books) {
      const cols = [0xe8504a, 0x3a7bd5, 0x2bb673, 0xf2a900, 0x8e5cf7, 0xff8a3d, 0x1e88e5, 0xc62828];
      for (let k = 0; k < shelves; k++) {
        let bx = -w / 2 + 0.15;
        const y0 = k * (h - 0.08) / shelves + 0.08, maxH = (h - 0.08) / shelves - 0.15;
        while (bx < w / 2 - 0.25) {
          const bw = 0.08 + Math.random() * 0.1, bh = maxH * (0.6 + Math.random() * 0.38);
          const b = B(bw, bh, 0.55 + Math.random() * 0.15, M('book' + ((k * 7 + (bx * 10 | 0)) % 8 + 8) % 8, { color: cols[((k * 7 + (bx * 10 | 0)) % 8 + 8) % 8] }), bx + bw / 2, y0 + bh / 2, 0.05, g);
          if (Math.random() < 0.08) b.rotation.z = 0.25;
          bx += bw + 0.015;
        }
      }
    }
    const hw = Math.abs(Math.cos(ry || 0)) > 0.5 ? w / 2 : 0.5, hd = Math.abs(Math.cos(ry || 0)) > 0.5 ? 0.5 : w / 2;
    K.addCol(x - hw, x + hw, z - hd, z + hd);
    return g;
  }
  function plant(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); K.scene.add(g);
    C(0.45, 0.32, 0.8, M('pot', { color: 0xd9824b }), 0, 0.4, 0, g, 14);
    C(0.47, 0.47, 0.08, M('potrim', { color: 0xb8653a }), 0, 0.8, 0, g, 14);
    const leaf = M('leaf', { color: 0x3f8f3a });
    for (let i = 0; i < 9; i++) {
      const l = add(new THREE.SphereGeometry(0.42, 8, 6), leaf, Math.cos(i * 2.4) * 0.3, 1.3 + (i % 3) * 0.35, Math.sin(i * 2.4) * 0.3, g);
      l.scale.set(0.5, 1.2, 0.25); l.rotation.set(Math.sin(i) * 0.6, i * 2.4, Math.cos(i) * 0.6);
    }
    K.addCol(x - 0.5 * s, x + 0.5 * s, z - 0.5 * s, z + 0.5 * s);
    return g;
  }
  function frame(x, y, z, w, h, ry, draw) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; K.scene.add(g);
    B(w + 0.2, h + 0.2, 0.08, gold(), 0, 0, 0, g);
    const t = tex('fr' + draw.name + w + h + Math.random(), 256, Math.round(256 * h / w), draw);
    add(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t }), 0, 0, 0.05, g);
    return g;
  }
  function wallClock(x, y, z, ry, r = 0.7) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; K.scene.add(g);
    C(r + 0.08, r + 0.08, 0.12, M('clockrim', { color: 0x2a2a3a }), 0, 0, 0, g, 32).rotation.x = PI / 2;
    const f = add(new THREE.CircleGeometry(r, 32), new THREE.MeshLambertMaterial({ map: clockTex }), 0, 0, 0.07, g);
    return g;
  }
  function pendant(x, y, z, color = 0xffe2a6) {
    C(0.02, 0.02, 1.2, M('wire', { color: 0x333333 }), x, y + 0.6, z, null, 6);
    const shadeM = M('lampshade', { phong: true, color: 0xf3e6cf, shininess: 40, side: THREE.DoubleSide });
    add(new THREE.ConeGeometry(0.55, 0.5, 20, 1, true), shadeM, x, y - 0.05, z);
    S(0.2, M('bulb', { color, emissive: 0xffc56b, emissiveIntensity: 1 }), x, y - 0.25, z, null, 12);
    K.glow(0xffd27a, 1.5, K.scene).position.set(x, y - 0.3, z);
  }
  function windowOn(x, y, z, ry, w = 2.4, h = 2.8) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; K.scene.add(g);
    add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glassTex }), 0, 0, 0.02, g);
    const fr = white();
    B(w + 0.3, 0.16, 0.2, fr, 0, h / 2, 0.05, g); B(w + 0.3, 0.16, 0.2, fr, 0, -h / 2, 0.05, g);
    B(0.16, h, 0.2, fr, -w / 2, 0, 0.05, g); B(0.16, h, 0.2, fr, w / 2, 0, 0.05, g);
    B(0.08, h, 0.12, fr, 0, 0, 0.06, g); B(w, 0.08, 0.12, fr, 0, h * 0.18, 0.06, g);
    B(w + 0.5, 0.12, 0.45, fr, 0, -h / 2 - 0.08, 0.2, g);            // حافة النافذة
    const cm = M('drape', { color: 0xf6e7c8, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const d = add(new THREE.CylinderGeometry(0.28, 0.4, h + 0.6, 10, 1, true, 0, PI), cm, s * (w / 2 + 0.35), 0.1, 0.25, g); d.rotation.y = s > 0 ? PI / 2 : -PI / 2; }
    return g;
  }
  // مكاتب الطلاب على جانبي الغرفة (تبقى ساحة اللعب في الوسط مفتوحة)
  function sideDesks(c, tint, n = 2) {
    for (const s of [-1, 1]) for (let k = 0; k < n; k++) desk(c.x + s * 8.6, c.z - 0.6 + k * 3, 1.6, { pen: tint, chairTint: tint, ry: s * PI / 2 });
  }
  function chalkboard(c, text, color) {
    const g = new THREE.Group(); g.position.set(c.x, 2.9, c.z - 10.9); K.scene.add(g);
    B(9.4, 3.4, 0.15, M('boardframe', { color: 0x8b5a2b }), 0, 0, 0, g);
    B(9, 3, 0.1, M('chalk', { color: 0x234a3a }), 0, 0, 0.06, g);
    B(9, 0.12, 0.3, M('boardframe', { color: 0x8b5a2b }), 0, -1.6, 0.18, g);
    for (let k = 0; k < 3; k++) C(0.03, 0.03, 0.2, white(), -3 + k * 0.3, -1.5, 0.2, g, 6).rotation.z = PI / 2;
    const sign = K.signPlane(text, 8, { size: 90, color: '#ffffff', maxW: 1400 });
    sign.position.set(c.x, 2.95, c.z - 10.72);
    return g;
  }

  /* ---------- هيكل كل غرفة ---------- */
  function shell(r, c, room) {
    const hex = col(room.color).getHex();
    const H = 7;
    // أرضية خشبية وسجادة
    const fl = add(new THREE.PlaneGeometry(22, 22), M('floor' + room.theme, { phong: true, map: woodFloorTex(room.theme === 'secret' ? '#5b4a3a' : '#b98552'), shininess: 35, specular: 0x332211 }), c.x, 0.005, c.z);
    fl.rotation.x = -PI / 2;
    // جدران: ألواح سفلية بلون الغرفة وورق جدران فاتح فوقها
    const upper = room.theme === 'secret' ? M('stoneWall', { map: stoneTex }) : M('wp' + hex, { map: wallpaperTex(hex) });
    const lower = room.theme === 'secret' ? upper : M('pn' + hex, { map: panelTex(hex) });
    const walls = [
      [22, c.x, c.z - 10.98, 0], [22, c.x - 10.98, c.z, PI / 2], [22, c.x + 10.98, c.z, -PI / 2],
    ];
    for (const [w, x, z, ry] of walls) {
      const u = add(new THREE.PlaneGeometry(w, H - 1.6), upper, x, 1.6 + (H - 1.6) / 2, z); u.rotation.y = ry;
      const l = add(new THREE.PlaneGeometry(w, 1.6), lower, x, 0.8, z); l.rotation.y = ry;
      const nx = Math.sin(ry), nz = Math.cos(ry);
      const rail = B(ry ? 0.12 : w, 0.14, ry ? w : 0.12, gold(), x + nx * 0.05, 1.62, z + nz * 0.05);
      const base = B(ry ? 0.1 : w, 0.22, ry ? w : 0.1, M('base', { color: 0x5a3a22 }), x + nx * 0.04, 0.11, z + nz * 0.04);
      const crown = B(ry ? 0.25 : w, 0.25, ry ? w : 0.25, white(), x + nx * 0.12, H - 0.12, z + nz * 0.12);
    }
    // الجدار الأمامي (جهة الباب) من الداخل
    for (const s of [-1, 1]) {
      const u = add(new THREE.PlaneGeometry(9, H), upper, c.x + s * 6.5, H / 2, c.z + 10.98); u.rotation.y = PI;
    }
    { const u = add(new THREE.PlaneGeometry(4, H - 4.6), upper, c.x, 4.6 + (H - 4.6) / 2, c.z + 10.98); u.rotation.y = PI; }
    // سقف بألواح وعوارض ومصابيح
    const ceil = add(new THREE.PlaneGeometry(22, 22), (matCache['ceil' + room.theme] = matCache['ceil' + room.theme] || new THREE.MeshBasicMaterial({ color: room.theme === 'secret' ? 0x2a2140 : 0xf3e9d8, side: THREE.DoubleSide })), c.x, H, c.z);
    ceil.rotation.x = PI / 2;
    for (let k = -2; k <= 2; k++) B(22, 0.25, 0.3, white(), c.x, H - 0.12, c.z + k * 4.4);
    if (room.theme !== 'secret') for (const [dx, dz] of [[-5.5, -2], [5.5, -2], [-5.5, 6], [5.5, 6]]) pendant(c.x + dx, H - 1.2, c.z + dz);
    // نوافذ على الجدارين الجانبيين
    if (room.theme !== 'secret' && room.theme !== 'stage') for (const s of [-1, 1]) for (const dz of [-2, 6.5]) windowOn(c.x + s * 10.95, 3.6, c.z + dz, -s * PI / 2);
    // سجادة في الوسط
    if (room.theme !== 'stage') { const rug = add(new THREE.PlaneGeometry(9, 6), M('rug' + hex, { map: rugTex(hex) }), c.x, 0.02, c.z + 3.6); rug.rotation.x = -PI / 2; }
    // إضاءة دافئة ناعمة
    // اسم الغرفة على الجدار الخلفي فوق كل شيء
    if (r.title) r.title.position.set(c.x, 6.1, c.z - 10.85);
  }

  /* ---------- أثاث كل غرفة حسب موضوعها ---------- */
  const THEMES = {
    spelling(r, c, room) {
      chalkboard(c, room.board || 'ض   ظ   ذ   ز');
      desk(c.x - 3.2, c.z - 8.8, 2.6, { chair: false, pen: 0xe8504a });                  // مكتب المعلم
      chair(c.x - 3.2, c.z - 9.8, 0, 0x8b5a2b);
      sideDesks(c, 0xe8504a);
      // مكعبات حروف متناثرة
      const L = ['ض', 'ظ', 'ذ', 'ز', 'ت', 'ة', 'ء'], bg = ['#e8504a', '#3a7bd5', '#2bb673', '#f2a900', '#8e5cf7', '#ff8a3d', '#1e88e5'];
      L.forEach((ch, k) => { const b = B(0.6, 0.6, 0.6, new THREE.MeshLambertMaterial({ map: letterTex(ch, bg[k]) }), c.x - 9.4 + (k % 3) * 0.75, 0.3 + Math.floor(k / 3) * 0.6, c.z + 7.8 - (k % 2) * 0.3); b.rotation.y = (k - 3) * 0.2; });
      K.addCol(c.x - 9.9, c.x - 7.5, c.z + 7.2, c.z + 8.3);
      bookshelf(c.x + 9.9, c.z + 4.5, 3, 2.6, -PI / 2);
      wallClock(c.x + 6, 5.2, c.z - 10.9, 0);
      plant(c.x - 9.6, c.z - 9.5);
    },
    grammar(r, c, room) {
      chalkboard(c, room.board || 'فاعل   مفعول   مبتدأ');
      desk(c.x + 2.8, c.z - 8.8, 2.6, { chair: false, pen: 0x2bb673 });
      sideDesks(c, 0x2bb673);
      // قطع كلمات كبيرة كأحجار بناء
      ['فِعل', 'اسم', 'حرف'].forEach((w, k) => { const b = RB(1.6, 0.8, 0.8, 0.12, M('wb' + k, { color: [0x2bb673, 0x3a7bd5, 0xf2a900][k] }), c.x - 9 + k * 0.1, 0.4 + k * 0.8, c.z + 7.5); const s = K.signPlane(w, 1.2, { size: 70, color: '#fff', maxW: 300 }); s.position.set(c.x - 9 + k * 0.1, 0.4 + k * 0.8, c.z + 7.92); });
      K.addCol(c.x - 9.9, c.x - 8.1, c.z + 7.1, c.z + 7.9);
      bookshelf(c.x + 9.9, c.z + 4.5, 3, 2.6, -PI / 2);
      wallClock(c.x - 6, 5.2, c.z - 10.9, 0);
      plant(c.x + 9.5, c.z - 9.5);
    },
    homework(r, c, room) {
      chalkboard(c, room.board || 'خطتي: أفهم، أنظّم، أنجز، أراجع');
      sideDesks(c, 0xf2a900);
      // أكوام أوراق الواجبات
      for (let s = 0; s < 3; s++) for (let k = 0; k < 8 + s * 3; k++) { const p = B(0.6, 0.02, 0.8, M('paperm', { map: paperTex }), c.x - 9 + s * 0.9, 0.01 + k * 0.025, c.z + 7.6); p.rotation.y = (Math.random() - 0.5) * 0.5; }
      K.addCol(c.x - 9.5, c.x - 6.8, c.z + 7.1, c.z + 8.1);
      // خزانة ملفات وساعة كبيرة
      for (let k = 0; k < 2; k++) { B(1, 2.4, 0.8, M('cab', { color: 0x7b8794 }), c.x + 9.9, 1.2, c.z + 3 + k * 1.1); for (let d = 0; d < 3; d++) B(0.05, 0.1, 0.3, metal(), c.x + 9.45, 0.5 + d * 0.75, c.z + 3 + k * 1.1); }
      K.addCol(c.x + 9.3, c.x + 10.5, c.z + 2.4, c.z + 4.7);
      wallClock(c.x - 6, 5.2, c.z - 10.9, 0, 0.9);
      plant(c.x + 9.5, c.z - 9.5);
    },
    listening(r, c, room) {
      // مكبرات صوت ضخمة ولوحات امتصاص الصوت
      for (const s of [-1, 1]) {
        const x = c.x + s * 3.2;
        RB(1.6, 3, 1.3, 0.12, M('spk', { color: 0x2a2a3a }), x, 1.5, c.z - 9.6);
        for (const [y, rr] of [[2.2, 0.5], [0.95, 0.35]]) { C(rr, rr, 0.1, M('cone', { color: 0x555577 }), x, y, c.z - 8.9, null, 24).rotation.x = PI / 2; S(rr * 0.35, M('cap', { color: 0x9aa3ad }), x, y, c.z - 8.85, null, 12); }
        K.addCol(x - 0.8, x + 0.8, c.z - 10.3, c.z - 8.9);
      }
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const p = B(1.1, 1.1, 0.2, M('foam' + (i + j) % 2, { color: (i + j) % 2 ? 0x3a7bd5 : 0x1e4f9a }), c.x - 5.5 + i * 2.2, 3.3 + j * 1.2, c.z - 10.85); }
      // حامل سماعات وغراموفون
      const g = new THREE.Group(); g.position.set(c.x - 9.2, 0, c.z + 7.5); K.scene.add(g);
      RB(1.4, 1, 1.4, 0.1, darkWood(), 0, 0.5, 0, g);
      C(0.04, 0.04, 0.8, gold(), 0, 1.4, 0, g, 8);
      const horn = add(new THREE.ConeGeometry(0.6, 1.1, 24, 1, true), M('horn', { phong: true, color: 0xd4a64a, shininess: 90, side: THREE.DoubleSide }), 0.3, 2, 0, g); horn.rotation.z = -PI / 2.5;
      K.addCol(c.x - 9.9, c.x - 8.5, c.z + 6.8, c.z + 8.2);
      for (let k = 0; k < 3; k++) { const hs = new THREE.Group(); hs.position.set(c.x + 9.2, 1.1, c.z + 2 + k * 1.6); K.scene.add(hs); add(new THREE.TorusGeometry(0.28, 0.05, 8, 20, PI), M('hp', { color: 0xe8504a }), 0, 0.3, 0, hs); for (const s of [-1, 1]) S(0.13, M('hpc', { color: 0x2a2a3a }), s * 0.28, 0.3, 0, hs, 10); C(0.04, 0.04, 1.1, metal(), 0, -0.25, 0, hs, 6); }
      K.addCol(c.x + 8.8, c.x + 9.6, c.z + 1.6, c.z + 5.6);
      plant(c.x + 9.5, c.z - 9.5);
    },
    tree(r, c, room) {   // المفردات والحفظ: شجرة كبيرة حقيقية في الوسط الخلفي
      const hex = col(room.color).getHex();
      const g = new THREE.Group(); g.position.set(c.x - 0.5, 0, c.z - 7.6); K.scene.add(g);
      const bark = M('bark', { color: 0x7a4f2a });
      C(0.7, 1.1, 4.2, bark, 0, 2.1, 0, g, 14);
      for (let k = 0; k < 5; k++) { const br = C(0.18, 0.35, 2.6, bark, Math.cos(k * 1.3) * 0.8, 4.6, Math.sin(k * 1.3) * 0.5, g, 8); br.rotation.set(Math.sin(k * 1.3) * 0.7, 0, -Math.cos(k * 1.3) * 0.7); }
      const leafM = M('canopy' + hex, { color: shade(hex, -0.05) }), leafM2 = M('canopy2' + hex, { color: shade(hex, 0.15) });
      for (let k = 0; k < 14; k++) { const a = k * 2.4, rr = 1 + (k % 4) * 0.7; const s = add(new THREE.IcosahedronGeometry(1.1 + (k % 3) * 0.3, 1), k % 2 ? leafM : leafM2, Math.cos(a) * rr, 5.4 + (k % 3) * 0.6, Math.sin(a) * rr * 0.6, g); s.rotation.set(k, k * 2, 0); }
      for (let k = 0; k < 6; k++) { const root = C(0.1, 0.3, 1.6, bark, Math.cos(k) * 0.9, 0.2, Math.sin(k) * 0.9, g, 6); root.rotation.set(Math.sin(k) * 1.2, 0, -Math.cos(k) * 1.2); }
      K.addCol(c.x - 1.6, c.x + 0.6, c.z - 8.7, c.z - 6.5);
      (room.words || []).forEach((w, k) => { const lb = K.label(w, 0.7, { size: 64, border: room.color }); lb.position.set(c.x - 3 + k * 3, 3.4 + (k % 2) * 0.8, c.z - 5.8); });
      // مقاعد حديقة وأحواض زهور
      for (const s of [-1, 1]) {
        const bx = c.x + s * 9.2, bz = c.z + 2.5;
        RB(1, 0.15, 3, 0.05, wood(), bx, 0.9, bz); for (const dz of [-1.2, 1.2]) B(0.9, 0.9, 0.12, darkWood(), bx, 0.45, bz + dz);
        K.addCol(bx - 0.55, bx + 0.55, bz - 1.6, bz + 1.6);
      }
      for (const [dx, dz] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 8], [9.5, 8]]) {
        B(1.6, 0.6, 1.6, M('planter', { color: 0xd9824b }), c.x + dx, 0.3, c.z + dz);
        for (let k = 0; k < 6; k++) { S(0.18, M('fl' + k % 3, { color: [0xe84d8a, 0xffd23f, 0xffffff][k % 3] }), c.x + dx - 0.5 + (k % 3) * 0.5, 0.75, c.z + dz - 0.3 + Math.floor(k / 3) * 0.6, null, 8); }
        K.addCol(c.x + dx - 0.8, c.x + dx + 0.8, c.z + dz - 0.8, c.z + dz + 0.8);
      }
      if (room.id === 'memory') {   // جدار صور الذكريات
        const draws = [(g, w, h) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8504a'; g.beginPath(); g.arc(w / 2, h / 2, w / 4, 0, PI * 2); g.fill(); },
          (g, w, h) => { g.fillStyle = '#9fd3f5'; g.fillRect(0, 0, w, h); g.fillStyle = '#2bb673'; g.fillRect(0, h * 0.6, w, h); },
          (g, w, h) => { g.fillStyle = '#e9d5ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#8e5cf7'; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w - 20, h - 20); g.lineTo(20, h - 20); g.fill(); }];
        for (let k = 0; k < 6; k++) frame(c.x + 10.9, 3.4 + (k % 2) * 1.4, c.z - 6 + Math.floor(k / 2) * 1.8, 1.2, 1, -PI / 2, draws[k % 3]);
      }
    },
    stage(r, c, room) {
      // خشبة مسرح بدرج وستائر مخملية وأضواء
      const st = new THREE.Group(); st.position.set(c.x, 0, c.z - 8); K.scene.add(st);
      RB(16, 1, 5.6, 0.1, M('stagewood', { phong: true, map: woodFloorTex('#8a5a32'), shininess: 50 }), 0, 0.5, 0, st);
      B(16.2, 0.15, 0.3, gold(), 0, 1, 2.85, st);
      for (let k = 0; k < 2; k++) B(4, 0.33, 0.6, darkWood(), 0, 0.17 + k * 0.33, 3.1 - k * 0.6, st);
      K.addCol(c.x - 8, c.x + 8, c.z - 10.8, c.z - 5.2);
      const cm = M('curtain', { map: curtainTex, side: THREE.DoubleSide });
      for (const s of [-1, 1]) for (let k = 0; k < 8; k++) C(0.32, 0.36, 6, cm, c.x + s * (8 - k * 0.42), 3.95, c.z - 5.4, null, 10);
      { const v = add(new THREE.PlaneGeometry(17, 1.4), cm, c.x, 6.4, c.z - 5.35); }
      B(17, 0.3, 0.3, gold(), c.x, 7, c.z - 5.3);
      if (r.title) r.title.position.set(c.x, 6.35, c.z - 5.1);
      // ميكروفون وأضواء مسرح
      C(0.03, 0.03, 1.6, metal(), c.x, 1.8, c.z - 6.5, null, 8); C(0.25, 0.3, 0.06, metal(), c.x, 1.03, c.z - 6.5, null, 16); S(0.11, M('mic', { color: 0x2a2a3a }), c.x, 2.65, c.z - 6.5, null, 12);
      for (const s of [-1, 1]) { const sp = C(0.25, 0.4, 0.7, M('spot', { color: 0x2a2a3a }), c.x + s * 5, 6.4, c.z - 2, null, 14); sp.rotation.x = -0.8; K.glow(0xfff2b0, 3, K.scene).position.set(c.x + s * 5, 6.1, c.z - 2.5); }
      { const pool = add(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, depthWrite: false }), c.x, 1.02, c.z - 8); pool.rotation.x = -PI / 2; }
      // كراسي الجمهور على الجانبين
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) chair(c.x + s * 9.3, c.z - 1 + k * 1.4, -s * PI / 2, 0xc62828);
      K.addCol(c.x - 9.9, c.x - 8.7, c.z - 1.6, c.z + 2.4); K.addCol(c.x + 8.7, c.x + 9.9, c.z - 1.6, c.z + 2.4);
    },
    review(r, c, room) {
      // صناديق كنز وخزائن بأقفال ذهبية
      for (let k = -2; k <= 2; k++) {
        const kx = c.x + k * 2.2, g = new THREE.Group(); g.position.set(kx, 0, c.z - 9.6); K.scene.add(g);
        RB(1.6, 1, 1, 0.08, M('chest', { color: 0x8b4a1f }), 0, 0.5, 0, g);
        const lid = add(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16, 1, false, 0, PI), M('chestlid', { color: 0x9c5a2a }), 0, 1, 0, g); lid.rotation.z = PI / 2;
        for (const dx of [-0.6, 0.6]) B(0.1, 1.5, 1.05, gold(), dx, 0.75, 0, g);
        B(0.3, 0.35, 0.1, gold(), 0, 0.8, 0.52, g);
        K.label('🔑', 0.5, { bg: null, size: 80, pad: 4 }).position.set(kx, 2.2, c.z - 9.5);
      }
      K.addCol(c.x - 5.3, c.x + 5.3, c.z - 10.2, c.z - 9);
      bookshelf(c.x - 9.9, c.z + 4.5, 3, 2.6, PI / 2);
      bookshelf(c.x + 9.9, c.z + 4.5, 3, 2.6, -PI / 2);
      wallClock(c.x + 7.5, 5.2, c.z - 10.9, 0);
    },
    tests(r, c, room) {
      chalkboard(c, room.board || 'لا تخافوا من الخطأ... الخطأ معلّم');
      sideDesks(c, 0x455a9c);
      wallClock(c.x - 7, 5.2, c.z - 10.9, 0, 1);
      // ساعة رملية كبيرة
      const hg = new THREE.Group(); hg.position.set(c.x - 9.2, 0, c.z + 7.6); K.scene.add(hg);
      C(0.8, 0.8, 0.15, darkWood(), 0, 0.08, 0, hg, 20); C(0.8, 0.8, 0.15, darkWood(), 0, 2.6, 0, hg, 20);
      const glass = M('hglass', { phong: true, color: 0xcfe8ff, transparent: true, opacity: 0.45, shininess: 100 });
      add(new THREE.ConeGeometry(0.6, 1.2, 20), glass, 0, 0.75, 0, hg).rotation.x = PI;
      add(new THREE.ConeGeometry(0.6, 1.2, 20), glass, 0, 1.95, 0, hg);
      add(new THREE.ConeGeometry(0.45, 0.6, 20), M('sand', { color: 0xf2c46b }), 0, 0.45, 0, hg);
      for (const a of [0, 2.1, 4.2]) C(0.05, 0.05, 2.5, darkWood(), Math.cos(a) * 0.7, 1.33, Math.sin(a) * 0.7, hg, 6);
      K.addCol(c.x - 10, c.x - 8.4, c.z + 6.8, c.z + 8.4);
      bookshelf(c.x + 9.9, c.z + 4.5, 3, 2.6, -PI / 2);
    },
    class(r, c, room) {
      chalkboard(c, room.board || 'مرحبًا بكم في صف شتشوت');
      for (let k = 0; k < 2; k++) desk(c.x + 8.6, c.z - 0.6 + k * 3, 1.6, { pen: 0xff8a3d, chairTint: 0xff8a3d, ry: PI / 2 });
      desk(c.x - 8.6, c.z + 2.4, 1.6, { pen: 0xff8a3d, chairTint: 0xff8a3d, ry: -PI / 2 });
      // خزائن حقائب ملونة
      for (let k = 0; k < 6; k++) { const cx = c.x - 10.4, cz = c.z - 6 + k * 1.05; B(0.9, 2, 1, M('cub' + k % 3, { color: [0xff8a3d, 0x3a7bd5, 0x2bb673][k % 3] }), cx, 1, cz); B(0.05, 0.6, 0.6, white(), cx + 0.46, 1.4, cz); }
      K.addCol(c.x - 10.9, c.x - 9.9, c.z - 6.6, c.z - 0.3);
      bookshelf(c.x + 9.9, c.z + 4.5, 3, 2.6, -PI / 2);
      frame(c.x + 10.9, 4, c.z - 5, 2.2, 1.6, -PI / 2, (g, w, h) => { g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff8a3d'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + i * 48, h / 2, 18, 0, PI * 2); g.fill(); } });
      wallClock(c.x - 6, 5.2, c.z - 10.9, 0);
      plant(c.x + 9.5, c.z - 9.5);
    },
    office(r, c, room) {
      // مكتب الأستاذة: مكتب خشبي كبير، ومكتبة، وكرسي مريح، وشهادات على الجدار
      const d = new THREE.Group(); d.position.set(c.x, 0, c.z - 6); K.scene.add(d);
      RB(4, 0.14, 1.6, 0.05, M('odesk', { phong: true, color: 0x7a4a2a, shininess: 60 }), 0, 1.2, 0, d);
      for (const s of [-1, 1]) RB(1.2, 1.15, 1.5, 0.05, M('odesk2', { color: 0x6b3e22 }), s * 1.3, 0.58, 0, d);
      for (let k = 0; k < 4; k++) B(0.5, 0.08, 0.7, M('obook' + k, { color: [0xe8504a, 0x3a7bd5, 0x2bb673, 0xf2a900][k] }), -1.4, 1.31 + k * 0.08, -0.2, d);
      C(0.12, 0.1, 0.25, M('mug', { color: 0x5b8bd6 }), 1.4, 1.4, 0.2, d, 12);
      const lamp = new THREE.Group(); lamp.position.set(1.5, 1.27, -0.4); d.add(lamp);
      C(0.18, 0.2, 0.05, metal(), 0, 0, 0, lamp, 12); C(0.02, 0.02, 0.7, metal(), 0, 0.35, 0, lamp, 6);
      add(new THREE.ConeGeometry(0.25, 0.3, 16, 1, true), M('olamp', { color: 0x2bb673, side: THREE.DoubleSide }), 0, 0.75, 0, lamp);
      K.addCol(c.x - 2, c.x + 2, c.z - 6.8, c.z - 5.2);
      // كرسي الأستاذة خلف المكتب
      const ch = new THREE.Group(); ch.position.set(c.x, 0, c.z - 7.6); K.scene.add(ch);
      RB(1.2, 0.3, 1.1, 0.12, M('leather', { phong: true, color: 0x7a1f2a, shininess: 30 }), 0, 1, 0, ch);
      RB(1.2, 1.5, 0.25, 0.12, M('leather', {}), 0, 1.85, -0.45, ch);
      C(0.06, 0.06, 0.85, metal(), 0, 0.45, 0, ch, 8);
      bookshelf(c.x - 9.9, c.z - 4, 4, 3.2, PI / 2);
      bookshelf(c.x + 9.9, c.z - 4, 4, 3.2, -PI / 2);
      for (let k = 0; k < 3; k++) frame(c.x - 4 + k * 4, 4.6, c.z - 10.9, 1.6, 1.1, 0, (g, w, h) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a64a'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); g.fillStyle = '#5b8bd6'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('★', w / 2, h / 2 + 14); });
      plant(c.x + 9.4, c.z + 8);
      plant(c.x - 9.4, c.z + 8);
      if (r.note) r.note.position.set(c.x, 3.2, c.z - 10.85);
    },
    secret(r, c, room) {
      // ممر حجري سري بمشاعل وأعمدة
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const x = c.x + s * 8.5, z = c.z - 8 + k * 6;
        C(0.6, 0.7, 7, M('pillar', { color: 0x7a6e90 }), x, 3.5, z, null, 12);
        B(1.6, 0.4, 1.6, M('pillar', {}), x, 0.2, z); B(1.6, 0.4, 1.6, M('pillar', {}), x, 6.8, z);
        K.addCol(x - 0.8, x + 0.8, z - 0.8, z + 0.8);
        const t = new THREE.Group(); t.position.set(x - s * 0.75, 3.2, z); K.scene.add(t);
        C(0.08, 0.05, 0.6, darkWood(), 0, 0, 0, t, 6);
        S(0.18, M('flame', { color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 1 }), 0, 0.4, 0, t, 10);
        K.glow(0xffa040, 2.4, t).position.y = 0.45;
      }
    },
  };
  THEMES.board = (r, c, room) => (THEMES[room.id] || THEMES.spelling)(r, c, room);

  function build(ctx, r, c, room) {
    K = ctx;
    // نخفي الأثاث المبسّط القديم داخل الغرفة (سبورة، مكاتب، شجرة كروية...) ونترك عناصر اللعب
    shell(r, c, room);
    const fn = THEMES[room.id] || THEMES[room.theme];
    if (fn) fn(r, c, room);
  }

  window.ROOMS3D = { build };
})();
