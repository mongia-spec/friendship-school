// الواجبات: المعلم يكتب واجبه فيحصل على رابط يرسله لطلابه، والطالب يفتحه فيجد واجبه في غرفة المهارة.
// الواجب كله داخل الرابط نفسه (لا خادم ولا حسابات ولا تسجيل صوت)، وتقدّم الطالب محفوظ في جهازه فقط.
// يحل الطالب داخل اللعبة: ورقة العمل أمامه وخانات بأرقام الأسئلة، وله وقت محدد قبل الضربة الأخيرة للوحش.
// لا يُهزم الوحش تمامًا قبل حل الواجب، وانتهاء الوقت يُضعف البطل. التصحيح عند المعلم؛ اللعبة لا تصحح الإجابات.
// يُحمَّل قبل game.js، وgame.js يستدعي HW.init ثم HW.pending وHW.gate.
(() => {
  const KEY = 'shtshout-homework', WORDS_KEY = 'shtshout-words', CUSTOM_KEY = 'shtshout-custom';
  const MAX_TEXT = 3000, MAX_Q = 40, DEFAULT_MINS = 15;
  const $ = (id) => document.getElementById(id);
  let ctx = { rooms: [], name: () => '', onTimeout: () => {} };
  let items = [], draft = [], tickId = 0, words = null, custom = {};

  function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* لا شيء */ } }
  const roomName = (id) => { const r = ctx.rooms.find((x) => x.id === id); return r ? r.name : ''; };
  const safeUrl = (u) => (/^https?:\/\/\S+$/i.test(u || '') ? u : '');
  const safeEmail = (m) => (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(m || '') ? m : '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  // أرقام الأسئلة: ما حدده المعلم، أو عدد الأسطر التي تبدأ برقم
  function countQuestions(text) {
    const n = String(text || '').split('\n').filter((l) => /^\s*[\d٠-٩]+\s*[).\-:ـ]/.test(l)).length;
    return n || 1;
  }

  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  }
  /* ---------- أسئلة المعلم: فحص كل ما يأتي من رابط أو ملف ---------- */
  const str = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);
  function cleanStep(s) {
    if (!s || typeof s !== 'object') return null;
    if (s.type === 'tiles' || s.type === 'choose') {
      const answer = str(s.answer, 120), q = str(s.q, 400);
      const options = [...new Set((Array.isArray(s.options) ? s.options : []).map((o) => str(o, 120)).filter(Boolean))].slice(0, 4);
      if (!q || !answer) return null;
      if (!options.includes(answer)) { if (options.length >= 4) options.pop(); options.push(answer); }
      if (options.length < 2) return null;
      const out = { type: s.type, q, answer, options };
      if (s.listen) out.listen = str(s.listen, 400);
      return out;
    }
    if (s.type === 'order' || s.type === 'memory') {
      const its = (Array.isArray(s.items) ? s.items : []).map((o) => str(o, 80)).filter(Boolean).slice(0, 10);
      if (its.length < 2) return null;
      const out = { type: s.type, title: str(s.title, 200) || 'رتّب بالترتيب الصحيح', items: its };
      if (s.type === 'memory') out.show = clampInt(s.show, 2, 20, 6);
      return out;
    }
    return null;
  }
  function cleanLibrary(l) {
    if (!l || typeof l !== 'object') return null;
    const out = {};
    if (Array.isArray(l.pages)) { const p = l.pages.map((x) => str(x, 300)).filter(Boolean); if (p.length === 5) out.pages = p; }
    if (Array.isArray(l.rounds)) {
      const r = l.rounds.map((x) => {
        const answer = str(x && x.answer, 80), clue = str(x && x.clue, 300);
        const options = [...new Set((Array.isArray(x && x.options) ? x.options : []).map((o) => str(o, 80)).filter(Boolean))];
        return clue && answer && options.length === 4 && options.includes(answer) ? { clue, answer, options } : null;
      }).filter(Boolean);
      if (r.length) out.rounds = r;
    }
    return out.pages || out.rounds ? out : null;
  }
  // يدمج أسئلة واردة؛ يعيد عدد الغرف التي تغيرت
  function mergeCustom(c) {
    if (!c || typeof c !== 'object') return 0;
    let n = 0;
    Object.keys(c).forEach((g) => {
      const gr = clampInt(g, 1, 9, 0), rooms = c[g];
      if (!gr || !rooms || typeof rooms !== 'object') return;
      Object.keys(rooms).forEach((id) => {
        if (!(ctx.editRooms || []).some((r) => r.id === id)) return;
        const v = id === 'library' ? cleanLibrary(rooms[id]) : (Array.isArray(rooms[id]) ? rooms[id].map(cleanStep).filter(Boolean).slice(0, 80) : null);
        if (!v || (Array.isArray(v) && !v.length)) return;
        (custom[gr] = custom[gr] || {})[id] = v;
        n++;
      });
    });
    if (n) saveCustom();
    return n;
  }
  function saveCustom() { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch (e) { /* لا شيء */ } }
  const hasCustom = () => Object.keys(custom).some((g) => Object.keys(custom[g] || {}).length);
  // يأخذ رابط واجب ويضيف ما فيه؛ يعيد عدد الجديد، أو -1 إن كان الرابط غير صحيح
  function addFromLink(text) {
    const m = String(text || '').match(/#hw=([\w-]+)/);
    if (!m) return -1;
    let d;
    try { d = decode(m[1]); } catch (e) { return -1; }
    return addPayload(d);
  }
  function addPayload(d) {
    if (!d || !Array.isArray(d.items) || !d.id) return -1;
    let added = mergeCustom(d.custom);
    if (d.words && Array.isArray(d.words.list) && d.words.list.length) {
      const id = String(d.id).slice(0, 20);
      if (!words || words.id !== id) added++;
      words = {
        id, topic: String(d.words.topic || '').slice(0, 60),
        list: d.words.list.slice(0, 40).map((x) => ({ a: String(x.a || '').slice(0, 24), w: (Array.isArray(x.w) ? x.w : []).slice(0, 3).map((v) => String(v).slice(0, 24)) })).filter((x) => x.a),
      };
      try { localStorage.setItem(WORDS_KEY, JSON.stringify(words)); } catch (e) { /* لا شيء */ }
    }
    d.items.forEach((it, k) => {
      if (!roomName(it.room)) return;
      const id = String(d.id).slice(0, 20) + '-' + k;
      if (items.some((x) => x.id === id)) return;
      const txt = String(it.text || '').slice(0, MAX_TEXT);
      items.push({
        id, room: it.room,
        title: String(it.title || 'واجب').slice(0, 80),
        text: txt,
        url: safeUrl(it.url),
        n: clampInt(it.n, 1, MAX_Q, countQuestions(txt)),
        mins: clampInt(it.mins, 1, 180, DEFAULT_MINS),
        paper: !!it.paper,
        teacher: String(d.teacher || '').slice(0, 60),
        email: safeEmail(d.email),
        answers: [], status: '', late: 0, used: 0,
      });
      added++;
    });
    save();
    return added;
  }

  const pendingItems = () => items.filter((x) => !x.status);
  const pending = (roomId) => items.some((x) => x.room === roomId && !x.status);
  const STATUS = { answered: 'حللتَ الواجب ✅', paper: 'ستسلّمه ورقيًا لمعلمك ✅' };

  function saveFile(name, html) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function sheet(it, heading, body) {
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(it.title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;line-height:1.9;font-size:18px}h1{font-size:26px;margin:0 0 6px}.m{color:#555;font-size:15px;margin-bottom:18px}.t{white-space:pre-wrap;border:2px solid #ddd;border-radius:10px;padding:14px}.f{margin-top:28px;font-size:13px;color:#666}</style></head><body><h1>${esc(heading)}</h1><div class="m">${esc(roomName(it.room))}${it.teacher ? ' · المعلم: ' + esc(it.teacher) : ''}${ctx.name() ? ' · الطالب: ' + esc(ctx.name()) : ' · اسم الطالب: ................'}</div><div class="t">${esc(body)}</div><p class="f">© 2026 لعبة «مدرسة الأصدقاء» من تأليف وتصميم الأستاذة منجية عادل · جميع الحقوق محفوظة</p></body></html>`;
  }
  const fileName = (it, word) => `${word}-${it.title}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60) + '.html';
  // نص الإجابات بأرقامها، مع الوقت، كما يصل إلى المعلم
  function answersText(it) {
    const lines = [];
    for (let k = 0; k < it.n; k++) lines.push(`${k + 1}) ${(it.answers[k] || '').trim()}`);
    const late = it.late ? ` · مرات انتهاء الوقت: ${it.late}` : '';
    return `${lines.join('\n')}\n\nالوقت بالدقائق: ${Math.max(1, Math.round((it.used || 0) / 60))} من ${it.mins}${late}`;
  }
  // ملفات Google Drive تُعرض داخل اللعبة؛ وغيرها يُفتح في صفحة مستقلة
  function embedUrl(u) {
    const m = String(u || '').match(/^https:\/\/(drive|docs)\.google\.com\/(file|document|presentation|spreadsheets)\/d\/([\w-]+)/);
    return m ? `https://${m[1]}.google.com/${m[2]}/d/${m[3]}/preview` : '';
  }

  /* ---------- شاشة الطالب: واجباتي ---------- */
  function renderList(msg) {
    const box = $('hwRows');
    box.innerHTML = '';
    if (!items.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'لا توجد واجبات بعد. افتح الرابط الذي أرسله معلمك، أو الصقه في الأسفل.'; box.appendChild(p); }
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'hw-row-item';
      const main = document.createElement('b'); main.textContent = it.title;
      const sub = document.createElement('small'); sub.textContent = `${roomName(it.room)} · ${it.status ? STATUS[it.status] : 'لم يُحلّ بعد'}`;
      b.append(main, sub);
      b.onclick = () => openView(it, null);
      box.appendChild(b);
    });
    $('hwCustomRow').hidden = !hasCustom();
    $('hwWordsRow').hidden = !words;
    if (words) $('hwWordsInfo').textContent = `كلمات المعلم في غرفة الإملاء${words.topic ? ': ' + words.topic : ''} (${words.list.length})`;
    $('hwListMsg').textContent = msg || '';
    const n = pendingItems().length;
    $('btnHomework').textContent = n ? `📥 واجباتي (${n})` : '📥 واجباتي';
  }
  function openList(msg) { renderList(msg); $('hwList').hidden = false; }

  /* ---------- ورقة العمل وخانات الإجابة ---------- */
  function openView(it, onDone) {
    $('hwList').hidden = true;
    if (!Array.isArray(it.answers)) it.answers = [];
    $('hwTitle').textContent = it.title;
    $('hwMeta').textContent = roomName(it.room) + (it.teacher ? ' · المعلم: ' + it.teacher : '');
    $('hwText').textContent = it.text;
    $('hwText').hidden = !it.text;
    const frame = embedUrl(it.url);
    $('hwFrame').hidden = !frame;
    $('hwFrame').src = frame || 'about:blank';
    $('hwGateNote').hidden = !onDone;
    $('hwPaper').hidden = !it.paper;
    $('hwSend').hidden = !it.email;
    $('hwNoEmail').hidden = !!it.email;
    $('hwGet').textContent = it.text ? '📥 نزّل ورقة الأسئلة' : '📄 افتح ملف الواجب';
    $('hwGet').hidden = !it.text && !it.url;
    // خانات بأرقام الأسئلة
    const nums = $('hwNums');
    nums.innerHTML = '';
    for (let k = 0; k < it.n; k++) {
      const row = document.createElement('label'); row.className = 'hw-num';
      const no = document.createElement('b'); no.textContent = k + 1;
      const inp = document.createElement('textarea'); inp.rows = 1; inp.dir = 'rtl'; inp.className = 'hw-input'; inp.value = it.answers[k] || '';
      inp.setAttribute('aria-label', 'إجابة السؤال ' + (k + 1));
      inp.oninput = () => { it.answers[k] = inp.value; save(); refresh(); };
      row.append(no, inp); nums.appendChild(row);
    }
    const filled = () => { let c = 0; for (let k = 0; k < it.n; k++) if ((it.answers[k] || '').trim()) c++; return c; };
    function refresh() {
      const c = filled(), all = c === it.n;
      $('hwFinish').disabled = !all;
      $('hwFinish').textContent = all ? '✅ أنهيتُ الواجب' : `أجبتَ عن ${c} من ${it.n}`;
      $('hwSend').disabled = !all;
      $('hwSaveAns').disabled = !all;
      $('hwState').textContent = it.status ? STATUS[it.status] : '';
      $('hwDone').disabled = !!onDone && !it.status;
      $('hwDone').textContent = onDone ? '⚔️ الضربة الأخيرة للوحش' : 'رجوع إلى واجباتي';
    }
    // الوقت: يعمل أثناء اللعب فقط، وإذا انتهى ضعف البطل ومُنح الطالب وقتًا إضافيًا ليكمل
    clearInterval(tickId);
    $('hwTimer').hidden = true;
    let left = 0, last = Date.now();
    if (onDone && !it.status) {
      left = it.mins * 60 - (it.used || 0);
      if (left <= 0) left = Math.ceil(it.mins * 30);
      $('hwTimer').hidden = false;
      const show = () => { const m = Math.floor(left / 60), s = Math.floor(left % 60); $('hwTimer').textContent = `⏳ الوقت المتبقي ${m}:${String(s).padStart(2, '0')}`; $('hwTimer').classList.toggle('low', left <= 60); };
      show();
      tickId = setInterval(() => {
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        if (it.status) { clearInterval(tickId); $('hwTimer').hidden = true; return; }
        left -= dt; it.used = (it.used || 0) + dt;
        if (left <= 0) {
          it.late = (it.late || 0) + 1;
          left = Math.ceil(it.mins * 30);
          ctx.onTimeout();
          $('hwState').textContent = '⏰ انتهى الوقت فضعف بطلك! لديك وقت إضافي، أكمل واجبك.';
        }
        save(); show();
      }, 500);
    }
    const mark = (s) => { it.status = s; save(); clearInterval(tickId); $('hwTimer').hidden = true; refresh(); };
    $('hwFinish').onclick = () => mark('answered');
    $('hwPaper').onclick = () => mark('paper');
    $('hwGet').onclick = () => {
      if (it.url) window.open(it.url, '_blank', 'noopener');
      if (it.text) saveFile(fileName(it, 'واجب'), sheet(it, it.title, it.text));
    };
    $('hwSaveAns').onclick = () => saveFile(fileName(it, 'حل'), sheet(it, 'حل: ' + it.title, answersText(it)));
    $('hwSend').onclick = () => {
      const who = ctx.name() || 'طالب';
      const subject = `حل واجب: ${it.title} — ${who}`;
      const body = `${answersText(it).slice(0, 1500)}\n\nالطالب: ${who}`;
      location.href = `mailto:${encodeURIComponent(it.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };
    $('hwDone').onclick = () => {
      clearInterval(tickId);
      save();
      $('hwFrame').src = 'about:blank';
      $('hwView').hidden = true;
      if (onDone) onDone(); else openList();
    };
    refresh();
    $('hwView').hidden = false;
  }
  // يُستدعى قبل الضربة الأخيرة: يبقى حتى يُحل كل واجب في هذه الغرفة
  async function gate(roomId) {
    let it;
    while ((it = items.find((x) => x.room === roomId && !x.status))) {
      await new Promise((res) => openView(it, res));
    }
    renderList();
  }

  /* ---------- شاشة المعلم: رفع الواجب ---------- */
  function renderDraft() {
    const box = $('hwDraft');
    box.innerHTML = '';
    draft.forEach((d, k) => {
      const row = document.createElement('div'); row.className = 'hw-draft-row';
      const t = document.createElement('span'); t.textContent = `${roomName(d.room)}: ${d.title} · عدد الأسئلة: ${d.n} · الوقت بالدقائق: ${d.mins}`;
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'حذف'; x.onclick = () => { draft.splice(k, 1); renderDraft(); };
      row.append(t, x); box.appendChild(row);
    });
  }
  // كلمات الإملاء: كلمة في كل سطر أو مفصولة بفواصل، ويمكن كتابة الأخطاء بعدها: مسؤول | مسئول | مسأول
  function readWords() {
    return $('hwfWords').value.split(/\n/).flatMap((line) => {
      if (line.includes('|')) { const p = line.split('|').map((x) => x.trim()).filter(Boolean); return p.length ? [{ a: p[0], w: p.slice(1, 4) }] : []; }
      return line.split(/[،,]/).map((x) => x.trim()).filter(Boolean).map((a) => ({ a, w: [] }));
    }).slice(0, 40);
  }
  // يأخذ ما في النموذج: يعيد true إن أُضيف واجب أو كان النموذج فارغًا تمامًا
  function takeForm() {
    const title = $('hwfTitle').value.trim(), text = $('hwfText').value.trim(), url = $('hwfUrl').value.trim();
    if (!title && !text && !url) return true;
    if (!text && !url) { $('hwfMsg').textContent = 'اكتب الأسئلة أو ضع رابط ملف الواجب.'; return false; }
    if (url && !safeUrl(url)) { $('hwfMsg').textContent = 'رابط الملف يجب أن يبدأ بـ https://'; return false; }
    if (!text && !$('hwfCount').value) { $('hwfMsg').textContent = 'حدّد عدد الأسئلة الموجودة في الملف.'; return false; }
    draft.push({
      room: $('hwfRoom').value, title: title || 'واجب ' + roomName($('hwfRoom').value), text, url,
      n: clampInt($('hwfCount').value, 1, MAX_Q, countQuestions(text)),
      mins: clampInt($('hwfMins').value, 1, 180, DEFAULT_MINS),
      paper: $('hwfPaper').checked,
    });
    $('hwfTitle').value = ''; $('hwfText').value = ''; $('hwfUrl').value = ''; $('hwfCount').value = '';
    $('hwfMsg').textContent = '';
    renderDraft();
    return true;
  }
  function makeLink() {
    if (!takeForm()) return;
    const list = readWords();
    if (!draft.length && !list.length) { $('hwfMsg').textContent = 'أضف واجبًا أو كلمات إملاء.'; return; }
    const email = $('hwfEmail').value.trim();
    if (email && !safeEmail(email)) { $('hwfMsg').textContent = 'البريد الإلكتروني غير صحيح.'; return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const link = location.origin + location.pathname + '#hw=' + encode({ v: 2, id, teacher: $('hwfTeacher').value.trim(), email, items: draft, words: list.length ? { topic: $('hwfTopic').value.trim(), list } : undefined });
    $('hwfLink').value = link;
    $('hwfWhats').href = 'https://wa.me/?text=' + encodeURIComponent('واجب جديد في لعبة مدرسة الأصدقاء:\n' + link);
    $('hwfOut').hidden = false;
    $('hwfMsg').textContent = link.length > 8000 ? 'الرابط طويل جدًا وقد لا يفتح عند بعض الطلاب: قسّم الواجب، أو ضعه في ملف وأرفق رابطه.' : 'جاهز. أرسل الرابط إلى طلابك.';
  }

  /* ---------- لوحة تعديل الأسئلة ---------- */
  let editList = null;
  const editKey = () => [clampInt($('hweGrade').value, 1, 9, 1), $('hweRoom').value];
  function field(ph, val, cls, oninput) {
    const t = document.createElement('textarea'); t.rows = 1; t.dir = 'rtl'; t.className = 'hw-input ' + (cls || ''); t.placeholder = ph; t.value = val || ''; t.oninput = () => oninput(t.value);
    return t;
  }
  const splitList = (v) => v.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);
  function renderEdit() {
    const box = $('hweRows');
    box.innerHTML = '';
    const lib = !Array.isArray(editList);
    $('hweAdd').hidden = lib;
    if (lib) {
      const h1 = document.createElement('h3'); h1.textContent = 'صفحات القصة الخمس بالترتيب'; h1.className = 'hw-label'; box.appendChild(h1);
      (editList.pages || []).forEach((p, k) => box.appendChild(field('الصفحة ' + (k + 1), p, '', (v) => { editList.pages[k] = v; })));
      const h2 = document.createElement('h3'); h2.textContent = 'ألغاز جسر الكلمات (أربعة خيارات لكل لغز)'; h2.className = 'hw-label'; box.appendChild(h2);
      (editList.rounds || []).forEach((r) => {
        const c = document.createElement('div'); c.className = 'hw-edit-row';
        c.append(field('اللغز', r.clue, '', (v) => { r.clue = v; }), field('الجواب الصحيح', r.answer, '', (v) => { r.answer = v; }), field('الخيارات الأربعة، بين كل خيار وآخر فاصلة', (r.options || []).join('، '), '', (v) => { r.options = splitList(v); }));
        box.appendChild(c);
      });
      return;
    }
    const NAMES = { tiles: 'بلاطات', choose: 'اختيارات', order: 'ترتيب', memory: 'حفظ' };
    editList.forEach((s, k) => {
      const c = document.createElement('div'); c.className = 'hw-edit-row';
      const top = document.createElement('div'); top.className = 'hw-edit-top';
      const tag = document.createElement('b'); tag.textContent = `${k + 1} · ${NAMES[s.type] || s.type}`;
      const del = document.createElement('button'); del.textContent = '🗑️ حذف'; del.onclick = () => { editList.splice(k, 1); renderEdit(); };
      top.append(tag, del); c.appendChild(top);
      if (s.type === 'order' || s.type === 'memory') {
        c.append(field('عنوان السؤال', s.title, '', (v) => { s.title = v; }), field('القطع بالترتيب الصحيح، بين كل قطعة وأخرى فاصلة', (s.items || []).join('، '), '', (v) => { s.items = splitList(v); }));
      } else {
        c.append(field('السؤال', s.q, '', (v) => { s.q = v; }), field('الجواب الصحيح', s.answer, '', (v) => { s.answer = v; }), field('الخيارات، بين كل خيار وآخر فاصلة', (s.options || []).join('، '), '', (v) => { s.options = splitList(v); }));
        if (s.listen !== undefined) c.append(field('الجملة التي يسمعها الطالب', s.listen, '', (v) => { s.listen = v; }));
      }
      box.appendChild(c);
    });
  }
  function loadEdit() {
    const [g, id] = editKey();
    const cur = custom[g] && custom[g][id];
    editList = JSON.parse(JSON.stringify(cur || ctx.bank(g, id)));
    $('hweState').textContent = cur ? 'هذه أسئلتك المعدّلة.' : 'هذه أسئلة اللعبة الأصلية.';
    $('hweMsg').textContent = '';
    renderEdit();
  }
  function saveEdit() {
    const [g, id] = editKey();
    let v, bad = 0;
    if (Array.isArray(editList)) {
      v = editList.map((s) => { const c = cleanStep(s); if (!c) bad++; return c; }).filter(Boolean);
      if (bad) { $('hweMsg').textContent = `عدد الأسئلة الناقصة: ${bad}. تأكد من السؤال والجواب والخيارات.`; return; }
      if (!v.length) { $('hweMsg').textContent = 'أبقِ سؤالًا واحدًا على الأقل، أو اضغط «إرجاع أسئلة اللعبة».'; return; }
    } else {
      v = cleanLibrary(editList);
      if (!v || !v.pages || !v.rounds || v.rounds.length !== editList.rounds.length) { $('hweMsg').textContent = 'تأكد من الصفحات الخمس، ومن أربعة خيارات لكل لغز فيها الجواب الصحيح.'; return; }
    }
    (custom[g] = custom[g] || {})[id] = v;
    saveCustom();
    $('hweState').textContent = 'هذه أسئلتك المعدّلة.';
    $('hweMsg').textContent = 'حُفظت أسئلتك على هذا الجهاز ✅ يبدأ العمل بها عند دخول الغرفة.';
    renderList();
  }
  const sharePayload = () => ({ v: 3, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), items: [], custom });

  function init(c) {
    ctx = c;
    items = load();
    try { const cu = JSON.parse(localStorage.getItem(CUSTOM_KEY)); if (cu && typeof cu === 'object') { custom = {}; mergeCustom(cu); } } catch (e) { /* لا شيء */ }
    $('hweGrade').innerHTML = (ctx.grades || []).map((n, i) => `<option value="${i + 1}">الصف ${esc(n)}</option>`).join('');
    $('hweRoom').innerHTML = (ctx.editRooms || []).map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    $('hwfEdit').onclick = () => { $('hwTeacher').hidden = true; $('hweLinkOut').hidden = true; loadEdit(); $('hwEdit').hidden = false; };
    $('hweClose').onclick = () => { $('hwEdit').hidden = true; $('hwTeacher').hidden = false; };
    $('hweGrade').onchange = loadEdit; $('hweRoom').onchange = loadEdit;
    $('hweSave').onclick = saveEdit;
    $('hweAdd').querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => {
      const type = b.dataset.add;
      editList.unshift(type === 'order' ? { type, title: '', items: [] } : { type, q: '', answer: '', options: [] });
      renderEdit();
    }; });
    $('hweReset').onclick = () => {
      const [g, id] = editKey();
      if (custom[g]) { delete custom[g][id]; saveCustom(); }
      loadEdit(); renderList();
      $('hweMsg').textContent = 'عادت أسئلة اللعبة الأصلية إلى هذه الغرفة.';
    };
    $('hweFile').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(sharePayload())], { type: 'application/json' }));
      a.download = 'أسئلة-مدرسة-الأصدقاء.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    $('hweLink').onclick = () => {
      if (!hasCustom()) { $('hweMsg').textContent = 'احفظ تعديلًا أولًا.'; return; }
      const link = location.origin + location.pathname + '#hw=' + encode(sharePayload());
      if (link.length > 8000) { $('hweLinkOut').hidden = true; $('hweMsg').textContent = 'أسئلتك كثيرة على رابط واحد، فأرسل الملف بدلًا منه.'; return; }
      $('hweLinkOut').value = link; $('hweLinkOut').hidden = false; $('hweLinkOut').select();
    };
    $('hwImport').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      let n = -1;
      try { if (f.size < 2000000) n = addPayload(JSON.parse(await f.text())); } catch (err) { n = -1; }
      openList(n > 0 ? 'صارت أسئلة المعلم في اللعبة ✅ ادخل الغرفة لتظهر.' : 'هذا الملف غير صحيح.');
    };
    $('hwCustomClear').onclick = () => { custom = {}; saveCustom(); renderList('عادت أسئلة اللعبة الأصلية.'); };
    $('hwfRoom').innerHTML = ctx.rooms.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    $('hwfText').maxLength = MAX_TEXT;
    $('btnTeacher').onclick = () => { $('hwTeacher').hidden = false; };
    $('hwfClose').onclick = () => { $('hwTeacher').hidden = true; };
    $('hwfAdd').onclick = () => { if (takeForm()) $('hwfOut').hidden = true; };
    $('hwfMake').onclick = makeLink;
    $('hwfCopy').onclick = async () => {
      $('hwfLink').select();
      try { await navigator.clipboard.writeText($('hwfLink').value); $('hwfMsg').textContent = 'نُسخ الرابط ✅'; }
      catch (e) { document.execCommand('copy'); $('hwfMsg').textContent = 'نُسخ الرابط ✅'; }
    };
    try { const w = JSON.parse(localStorage.getItem(WORDS_KEY)); if (w && Array.isArray(w.list) && w.list.length) words = w; } catch (e) { /* لا شيء */ }
    $('hwWordsClear').onclick = () => { words = null; try { localStorage.removeItem(WORDS_KEY); } catch (e) { /* لا شيء */ } renderList('عادت أسئلة اللعبة الأصلية إلى غرفة الإملاء.'); };
    $('btnHomework').onclick = () => openList();
    $('hwListClose').onclick = () => { $('hwList').hidden = true; };
    $('hwPasteGo').onclick = () => {
      const n = addFromLink($('hwPaste').value);
      $('hwPaste').value = '';
      openList(n < 0 ? 'هذا الرابط غير صحيح.' : n === 0 ? 'هذا الواجب موجود عندك من قبل.' : `عدد الإضافات الجديدة: ${n} ✅`);
    };
    // فتح الطالب رابط واجب
    if (location.hash.startsWith('#hw=')) {
      const n = addFromLink(location.hash);
      history.replaceState(null, '', location.pathname + location.search);
      openList(n < 0 ? 'رابط الواجب غير صحيح. اطلب من معلمك رابطًا جديدًا.' : n > 0 ? 'وصلك شيء جديد من معلمك! اذهب إلى غرفة الواجب في الممر.' : '');
    } else renderList();
  }

  window.HW = { init, pending, gate, openList, words: () => words, custom: (g, id) => (custom[g] && custom[g][id]) || null };
})();
