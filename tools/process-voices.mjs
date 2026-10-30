// يفك ملفات Speko الخام ويعالجها بـ ffmpeg إلى voices/<id>.mp3 (رفع طبقة أصوات الأطفال، توحيد الارتفاع)
// ويكتب voices/voices.js ليعرف كود اللعبة أي الجمل لها صوت.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [rawDir] = process.argv.slice(2);
const here = new URL('..', import.meta.url);
const map = JSON.parse(readFileSync(new URL('tools/voices-map.json', here)));
const FX = {
  shtshout: 'asetrate=24000*1.3,aresample=24000,atempo=0.85',
  shtshouta: 'asetrate=24000*1.3,aresample=24000,atempo=0.85',
  friend: 'asetrate=24000*1.22,aresample=24000,atempo=0.88',
  monster: 'asetrate=24000*0.88,aresample=24000,atempo=1.08',
  girl: 'asetrate=24000*1.2,aresample=24000,atempo=0.9',
  narrator: 'anull', mongia: 'anull',
};
mkdirSync(new URL('voices/raw', here), { recursive: true });
const out = {};
for (const [id, [who, stamp]] of Object.entries(map)) {
  const j = JSON.parse(readFileSync(`${rawDir}/mcp-4a399b94-ee6d-411b-bc42-e278c96ba70f-audio_synthesize-${stamp}.txt`, 'utf8'));
  const wav = new URL(`voices/raw/${id}.wav`, here), mp3 = new URL(`voices/${id}.mp3`, here);
  writeFileSync(wav, Buffer.from(j.audio_base64, 'base64'));
  const af = `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,${FX[who]},loudnorm=I=-16:TP=-1.5`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', fileURLToPath(wav), '-af', af, '-ar', '24000', '-ac', '1', '-b:a', '64k', fileURLToPath(mp3)]);
  out[id] = `voices/${id}.mp3`;
  console.log(id, who, j.duration_seconds + 's');
}
writeFileSync(new URL('voices/voices.js', here), '// مولَّد آليًا من tools/process-voices.mjs\nwindow.VOICES = ' + JSON.stringify(out, null, 1) + ';\n');
