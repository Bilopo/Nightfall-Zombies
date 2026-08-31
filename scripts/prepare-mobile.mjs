import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = process.cwd();
const webDir = join(root, 'www');
const files = ['index.html','style.css','game.js','manifest.json','sw.js'];

await rm(webDir, { recursive: true, force: true });
await mkdir(join(webDir, 'vendor'), { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(webDir, file));
}

await copyFile(
  join(root, 'node_modules', 'three', 'build', 'three.module.js'),
  join(webDir, 'vendor', 'three.module.js')
);

const htmlPath = join(webDir, 'index.html');
let html = await readFile(htmlPath, 'utf8');
html = html.replace(
  'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
  './vendor/three.module.js'
);
html = html.replace(
  /<script>if\('serviceWorker' in navigator\)[\s\S]*?<\/script>/,
  '<script>/* service worker disabled inside native Capacitor shell */</script>'
);
await writeFile(htmlPath, html, 'utf8');

console.log('Nightfall Zombies mobile bundle ready in ./www');
