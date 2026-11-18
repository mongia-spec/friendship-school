// اللغات: العربية (الأصل) والإنجليزية والفرنسية. لإضافة لغة جديدة:
// 1) انسخي lang/en.js باسم اللغة الجديدة (مثل lang/es.js) وترجمي القيم فقط (المفاتيح العربية تبقى كما هي).
// 2) أضيفي رمزها واسمها في LANGS أسفله، وأضيفي <script src="lang/es.js"> في index.html.
// النصوص التي لا ترجمة لها تبقى بالعربية، لذلك لا تتعطل اللعبة أبدًا.
(function () {
  const LANGS = { ar: 'العربية', en: 'English', fr: 'Français' };
  const RTL = ['ar'];
  const AR = /[؀-ۿ]/;
  let q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* لا شيء */ }
  let saved = null;
  try { saved = localStorage.getItem('fs_lang'); } catch (e) { /* لا شيء */ }
  let lang = (q && LANGS[q]) ? q : (saved && LANGS[saved]) ? saved : 'ar';
  if (q && LANGS[q]) { try { localStorage.setItem('fs_lang', q); } catch (e) { /* لا شيء */ } }

  const dicts = {}, patCache = {};
  const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

  function patterns(l) {
    if (patCache[l]) return patCache[l];
    const d = dicts[l] || {};
    const list = Object.keys(d).filter((k) => /\{\d\}/.test(k)).sort((a, b) => b.length - a.length)
      .map((k) => [new RegExp('^' + esc(k).replace(/\\?\{(\d)\\?\}/g, '([\\s\\S]+?)') + '$'), k, d[k]]);
    patCache[l] = list;
    return list;
  }

  function tr(s, depth = 0) {
    if (lang === 'ar' || s == null) return s;
    s = String(s);
    if (!AR.test(s)) return s;
    const d = dicts[lang] || {};
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    const t = s.trim();
    if (t && t !== s) { const r = tr(t, depth); if (r !== t) return s.replace(t, r); }
    if (depth > 4) return s;
    for (const [re, , val] of patterns(lang)) {
      const m = s.match(re);
      if (m) return val.replace(/\{(\d)\}/g, (_, i) => tr(m[+i + 1], depth + 1));
    }
    const splitTry = (sep, join) => {
      if (!s.includes(sep)) return null;
      const parts = s.split(sep), out = parts.map((p) => tr(p, depth + 1));
      return out.some((x, i) => x !== parts[i]) ? out.join(join) : null;
    };
    let r = splitTry(' · ', ' · ') ?? splitTry('\n', '\n');
    if (r != null) return r;
    const sents = s.split(/(?<=[.!؟?])\s+/);
    if (sents.length > 1) {
      const out = sents.map((p) => tr(p, depth + 1));
      if (out.some((x, i) => x !== sents[i])) return out.join(' ');
    }
    r = splitTry('، ', ', ');
    if (r != null) return r;
    return s;
  }

  // ترجمة كل ما يظهر في الصفحة، إلا محتوى الدروس (الأسئلة والنصوص العربية) وما يكتبه المعلم والطالب
  const SKIP = '#quizQ, #quizOpts, .page-card, #memBox, #hwText, textarea, [data-noi18n]';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function trText(n) {
    const v = n.nodeValue;
    if (!v || !AR.test(v) || (n.parentElement && n.parentElement.closest(SKIP))) return;
    const r = tr(v);
    if (r !== v) n.nodeValue = r;
  }
  function trEl(el) {
    if (el.closest && el.closest(SKIP)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && AR.test(v)) { const r = tr(v); if (r !== v) el.setAttribute(a, r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1) return;
    trEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? trText(n) : trEl(n);
  }

  function setLang(l) {
    if (!LANGS[l]) return;
    try { localStorage.setItem('fs_lang', l); } catch (e) { /* لا شيء */ }
    const u = new URL(location.href);
    u.searchParams.set('lang', l);
    location.href = u.toString();
  }

  function fillSelect(sel) {
    if (!sel) return;
    sel.innerHTML = Object.keys(LANGS).map((k) => `<option value="${k}"${k === lang ? ' selected' : ''}>${LANGS[k]}</option>`).join('');
    sel.setAttribute('data-noi18n', '');
    sel.onchange = () => setLang(sel.value);
  }

  function start() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    document.querySelectorAll('select.lang-select').forEach(fillSelect);
    if (lang === 'ar') return;
    document.title = tr(document.title);
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') trEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  window.I18N = {
    get lang() { return lang; },
    langs: LANGS,
    rtl: () => RTL.includes(lang),
    add(l, d) { dicts[l] = Object.assign(dicts[l] || {}, d); patCache[l] = null; },
    tr, setLang, start,
  };
  window.tr = tr;
})();
