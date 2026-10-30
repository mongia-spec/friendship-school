// الواجبات: المعلم يكتب واجبه فيحصل على رابط يرسله لطلابه، والطالب يفتحه فيجد واجبه في غرفة المهارة.
// الواجب كله داخل الرابط نفسه (لا خادم ولا حسابات ولا تسجيل صوت)، وتقدّم الطالب محفوظ في جهازه فقط.
// يحل الطالب داخل اللعبة: ورقة العمل أمامه وخانات بأرقام الأسئلة، وله وقت محدد قبل الضربة الأخيرة للوحش.
// لا يُهزم الوحش تمامًا قبل حل الواجب، وانتهاء الوقت يُضعف البطل. التصحيح عند المعلم؛ اللعبة لا تصحح الإجابات.
// يُحمَّل قبل game.js، وgame.js يستدعي HW.init ثم HW.pending وHW.gate.
(() => {
  const KEY = 'shtshout-homework';
  const MAX_TEXT = 3000, MAX_Q = 40, DEFAULT_MINS = 15;
  const $ = (id) => document.getElementById(id);
  let ctx = { rooms: [], name: () => '', onTimeout: () => {} };
  let items = [], draft = [], tickId = 0;

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
  // يأخذ رابط واجب ويضيف ما فيه من واجبات؛ يعيد عدد الجديد، أو -1 إن كان الرابط غير صحيح
  function addFromLink(text) {
    const m = String(text || '').match(/#hw=([\w-]+)/);
    if (!m) return -1;
    let d;
    try { d = decode(m[1]); } catch (e) { return -1; }
    if (!d || !Array.isArray(d.items) || !d.id) return -1;
    let added = 0;
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
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(it.title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;line-height:1.9;font-size:18px}h1{font-size:26px;margin:0 0 6px}.m{color:#555;font-size:15px;margin-bottom:18px}.t{white-space:pre-wrap;border:2px solid #ddd;border-radius:10px;padding:14px}.f{margin-top:28px;font-size:13px;color:#666}</style></head><body><h1>${esc(heading)}</h1><div class="m">${esc(roomName(it.room))}${it.teacher ? ' · المعلم: ' + esc(it.teacher) : ''}${ctx.name() ? ' · الطالب: ' + esc(ctx.name()) : ' · اسم الطالب: ................'}</div><div class="t">${esc(body)}</div><p class="f">© 2026 لعبة «مدرسة الصداقة» من تأليف وتصميم الأستاذة منجية عادل · جميع الحقوق محفوظة</p></body></html>`;
  }
  const fileName = (it, word) => `${word}-${it.title}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60) + '.html';
  // نص الإجابات بأرقامها، مع الوقت، كما يصل إلى المعلم
  function answersText(it) {
    const lines = [];
    for (let k = 0; k < it.n; k++) lines.push(`${k + 1}) ${(it.answers[k] || '').trim()}`);
    const late = it.late ? ` · انتهى الوقت ${it.late} مرة` : '';
    return `${lines.join('\n')}\n\nالوقت: ${Math.max(1, Math.round((it.used || 0) / 60))} دقيقة من ${it.mins}${late}`;
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
      const t = document.createElement('span'); t.textContent = `${roomName(d.room)}: ${d.title} · ${d.n} أسئلة · ${d.mins} دقيقة`;
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'حذف'; x.onclick = () => { draft.splice(k, 1); renderDraft(); };
      row.append(t, x); box.appendChild(row);
    });
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
    if (!draft.length) { $('hwfMsg').textContent = 'أضف واجبًا واحدًا على الأقل.'; return; }
    const email = $('hwfEmail').value.trim();
    if (email && !safeEmail(email)) { $('hwfMsg').textContent = 'البريد الإلكتروني غير صحيح.'; return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const link = location.origin + location.pathname + '#hw=' + encode({ v: 2, id, teacher: $('hwfTeacher').value.trim(), email, items: draft });
    $('hwfLink').value = link;
    $('hwfWhats').href = 'https://wa.me/?text=' + encodeURIComponent('واجب جديد في لعبة مدرسة الصداقة:\n' + link);
    $('hwfOut').hidden = false;
    $('hwfMsg').textContent = link.length > 8000 ? 'الرابط طويل جدًا وقد لا يفتح عند بعض الطلاب: قسّم الواجب، أو ضعه في ملف وأرفق رابطه.' : 'جاهز. أرسل الرابط إلى طلابك.';
  }

  function init(c) {
    ctx = c;
    items = load();
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
    $('btnHomework').onclick = () => openList();
    $('hwListClose').onclick = () => { $('hwList').hidden = true; };
    $('hwPasteGo').onclick = () => {
      const n = addFromLink($('hwPaste').value);
      $('hwPaste').value = '';
      openList(n < 0 ? 'هذا الرابط غير صحيح.' : n === 0 ? 'هذا الواجب موجود عندك من قبل.' : `أُضيف ${n} واجب ✅`);
    };
    // فتح الطالب رابط واجب
    if (location.hash.startsWith('#hw=')) {
      const n = addFromLink(location.hash);
      history.replaceState(null, '', location.pathname + location.search);
      openList(n < 0 ? 'رابط الواجب غير صحيح. اطلب من معلمك رابطًا جديدًا.' : n > 0 ? 'وصلك واجب جديد من معلمك! اذهب إلى غرفته في الممر.' : '');
    } else renderList();
  }

  window.HW = { init, pending, gate, openList };
})();
