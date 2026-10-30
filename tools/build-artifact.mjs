// يجهّز نسخة المعاينة على claude.ai: نفس index.html بلا وسوم html/head/body
// (منصة النشر تضيفها بنفسها). الناتج: artifact.html بجانب index.html.
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('..', import.meta.url);
const src = readFileSync(new URL('index.html', here), 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync(new URL('artifact.html', here),
  head.trim() + '\n<style>html,body{height:100%;background:#1b1440}</style>\n' + body.trim() + '\n');
console.log('artifact.html ready');
