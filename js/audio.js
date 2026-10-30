// مؤثرات صوتية وموسيقى مولَّدة بالكامل في المتصفح (Web Audio) — بلا ملفات ولا خدمات خارجية.
window.SFX = (() => {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null, musicMood = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  }

  function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = 0, out = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { vol = 0.2, freq = 800, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  const sounds = {
    star() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.22, delay: i * 0.06 })); },
    page() { noise(0.18, { vol: 0.25, freq: 3000, q: 0.7 }); tone(660, 0.15, { type: 'triangle', vol: 0.2, delay: 0.05, slide: 400 }); },
    jump() { tone(300, 0.22, { type: 'square', vol: 0.08, slide: 500 }); },
    land() { noise(0.08, { vol: 0.12, freq: 300 }); },
    good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, delay: i * 0.08 })); },
    bad() { tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: -80 }); tone(196, 0.3, { type: 'sawtooth', vol: 0.07, delay: 0.12, slide: -60 }); },
    growl() { tone(90, 0.7, { type: 'sawtooth', vol: 0.12, slide: -30 }); noise(0.6, { vol: 0.12, freq: 220, q: 3 }); },
    boo() { tone(160, 0.5, { type: 'square', vol: 0.1, slide: -90 }); noise(0.4, { vol: 0.15, freq: 500 }); },
    hit() { tone(400, 0.3, { type: 'square', vol: 0.1, slide: -300 }); noise(0.3, { vol: 0.2, freq: 1200 }); },
    magic() { for (let i = 0; i < 8; i++) tone(600 + i * 140, 0.3, { type: 'sine', vol: 0.12, delay: i * 0.05 }); noise(0.8, { vol: 0.08, freq: 5000, q: 0.5 }); },
    door() { tone(140, 0.5, { type: 'triangle', vol: 0.2, slide: 90 }); noise(0.4, { vol: 0.1, freq: 400 }); },
    blip() { tone(740, 0.06, { type: 'square', vol: 0.05 }); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.12 })); },
  };

  // موسيقى خلفية بسيطة متكررة (سلم خماسي مرح أو غامض)
  const MOODS = {
    yard: { tempo: 0.22, bass: [196, 196, 220, 174.6], notes: [392, 440, 523, 587, 659, 784] },
    library: { tempo: 0.28, bass: [146.8, 146.8, 138.6, 130.8], notes: [293.7, 349.2, 392, 440, 523.3, 587.3] },
    title: { tempo: 0.26, bass: [261.6, 220, 174.6, 196], notes: [523, 587, 659, 784, 880] },
  };
  // الأستاذة منجية وجدت هذه الموسيقى المولَّدة مزعجة («مثل المركبة الفضائية»): متوقفة حتى نضع موسيقى حقيقية
  const MUSIC_ON = false;
  function music(mood) {
    if (!MUSIC_ON) return;
    if (musicMood === mood) return;
    musicMood = mood;
    clearInterval(musicTimer);
    if (!ctx || !mood) return;
    const m = MOODS[mood];
    let step = 0;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      if (step % 8 === 0) tone(m.bass[(step / 8) % m.bass.length], m.tempo * 7, { type: 'triangle', vol: 0.5, out: musicGain });
      if (Math.random() < 0.7) tone(m.notes[(Math.random() * m.notes.length) | 0], m.tempo * 1.6, { type: 'sine', vol: 0.35, out: musicGain });
      step++;
    }, m.tempo * 1000);
  }

  return {
    init,
    play(name) { if (ctx && !muted && sounds[name]) sounds[name](); },
    music,
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.7; return !muted; },
    get muted() { return muted; },
  };
})();
