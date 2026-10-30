// يفحص ملفات محتوى الصفوف (content/grades-*.js) قبل إدخالها في اللعبة.
// الاستعمال: node tools/check-grades.mjs content/grades-1-3.js [ملفات أخرى...]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOMS = ['spelling', 'grammar', 'listening', 'vocab', 'expression', 'homework', 'memory', 'review', 'tests'];
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of process.argv.slice(2)) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
const G = ctx.window.GRADES || {};
const errs = [];
const err = (where, msg) => errs.push(`${where}: ${msg}`);
const uniq = (a) => new Set(a).size === a.length;

function checkChoose(w, s) {
  if (typeof s.q !== 'string' || !s.q) err(w, 'q مفقود');
  if (!Array.isArray(s.options) || s.options.length < 3 || s.options.length > 4) err(w, 'options يجب أن تكون 3 أو 4');
  else {
    if (!s.options.includes(s.answer)) err(w, `الجواب «${s.answer}» ليس بين الخيارات`);
    if (!uniq(s.options)) err(w, 'خيارات مكررة');
  }
}
function checkStep(w, s, room) {
  if (s.type === 'tiles') {
    if (typeof s.q !== 'string' || !s.q) err(w, 'q مفقود');
    if (!Array.isArray(s.options) || s.options.length !== 4) err(w, 'tiles تحتاج 4 خيارات بالضبط');
    else { if (!s.options.includes(s.answer)) err(w, `الجواب «${s.answer}» ليس بين الخيارات`); if (!uniq(s.options)) err(w, 'خيارات مكررة'); }
  } else if (s.type === 'choose') {
    checkChoose(w, s);
    if (room === 'listening' && !s.listen) err(w, 'سؤال الاستماع يحتاج listen');
  } else if (s.type === 'order') {
    if (!s.title) err(w, 'title مفقود');
    if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 6) err(w, 'order يحتاج 3 إلى 6 عناصر');
    else if (!uniq(s.items)) err(w, 'عناصر مكررة في order');
  } else if (s.type === 'memory') {
    if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 7) err(w, 'memory يحتاج 3 إلى 7 عناصر');
    else if (!uniq(s.items)) err(w, 'عناصر مكررة في memory');
    if (!(s.show >= 3 && s.show <= 10)) err(w, 'show بين 3 و10 ثوانٍ');
  } else if (s.type === 'collect') {
    if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 7) err(w, 'collect يحتاج 3 إلى 7 أسئلة');
    else s.items.forEach((it, i) => checkChoose(`${w}.items[${i}]`, it));
  } else err(w, `نوع غير معروف: ${s.type}`);
}

for (const g of Object.keys(G)) {
  const d = G[g];
  const L = d.library;
  if (!L) err(`صف ${g}`, 'library مفقود');
  else {
    if (!Array.isArray(L.pages) || L.pages.length !== 5 || !uniq(L.pages)) err(`صف ${g}.library.pages`, 'خمس صفحات مختلفة بالترتيب الصحيح');
    if (!Array.isArray(L.rounds) || L.rounds.length !== 4) err(`صف ${g}.library.rounds`, 'أربعة ألغاز');
    else L.rounds.forEach((r, i) => {
      const w = `صف ${g}.library.rounds[${i}]`;
      if (!r.clue) err(w, 'clue مفقود');
      if (!Array.isArray(r.options) || r.options.length !== 4) err(w, '4 خيارات بالضبط');
      else { if (!r.options.includes(r.answer)) err(w, 'الجواب ليس بين الخيارات'); if (!uniq(r.options)) err(w, 'خيارات مكررة'); }
    });
  }
  for (const room of ROOMS) {
    const R = d[room];
    if (!R || !Array.isArray(R.steps) || !R.steps.length) { err(`صف ${g}.${room}`, 'steps مفقودة'); continue; }
    R.steps.forEach((s, i) => checkStep(`صف ${g}.${room}.steps[${i}]`, s, room));
    if (room === 'review' && !(R.steps.length === 1 && R.steps[0].type === 'collect')) err(`صف ${g}.review`, 'المراجعة خطوة collect واحدة');
  }
}
console.log('الصفوف:', Object.keys(G).join('، ') || 'لا شيء');
if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
console.log('سليم ✓');
