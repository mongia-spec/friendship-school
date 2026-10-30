// يحوّل GLTFLoader وSkeletonUtils (وحدات ES في three r149) إلى سكربت عادي vendor/three-addons.js
// حتى تبقى اللعبة تعمل بفتح index.html مباشرة (file://) حيث لا تعمل وحدات ES.
// الاستعمال: node game/tools/build-addons.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const jsm = new URL('node_modules/three/examples/jsm/', import.meta.url);
const read = (p) => readFileSync(new URL(p, jsm), 'utf8');

// كتلة import { a, b } from 'three'  ←  const { a, b } = THREE;
const fromThree = (src) => src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'three';/, 'const {$1} = THREE;');

// دالة toTrianglesDrawMode وحدها من BufferGeometryUtils
const bgu = read('utils/BufferGeometryUtils.js');
const start = bgu.indexOf('function toTrianglesDrawMode(');
let depth = 0, end = bgu.indexOf('{', start);
for (let i = end; i < bgu.length; i++) {
  if (bgu[i] === '{') depth++;
  else if (bgu[i] === '}' && --depth === 0) { end = i + 1; break; }
}
const toTri = bgu.slice(start, end);

let gltf = fromThree(read('loaders/GLTFLoader.js'))
  .replace("import { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js';", toTri)
  .replace('export { GLTFLoader };', 'THREE.GLTFLoader = GLTFLoader;');

let skel = fromThree(read('utils/SkeletonUtils.js'))
  .replace(/export\s*\{([\s\S]*?)\};/, 'THREE.SkeletonUtils = {$1};');

const banner = '// مولَّد آليًا من tools/build-addons.mjs (three r149، رخصة MIT)\n';
writeFileSync(new URL('../vendor/three-addons.js', import.meta.url),
  banner + '(function () {\n' + gltf + '\n})();\n(function () {\n' + skel + '\n})();\n');
console.log('vendor/three-addons.js ready');
