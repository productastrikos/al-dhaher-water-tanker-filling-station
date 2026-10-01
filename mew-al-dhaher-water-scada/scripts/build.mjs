// Static "build": copies only the files the app loads into dist/ so that
// internal material (docs, reference PDFs/PPTX, tools, launchers) is never
// served. No dependencies, no bundling - the app is plain HTML/CSS/JS.
import { cpSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const skipDirs = new Set(['dist', 'docs', 'reference', 'tools', 'scripts', 'node_modules', '.claude']);
const skipFiles = new Set(['.htaccess', 'package.json', 'package-lock.json']);
const skipExts = new Set(['.md', '.bat', '.ps1', '.py', '.pyc']);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

let count = 0;
for (const e of readdirSync(root, { withFileTypes: true })) {
  if (e.isDirectory()) {
    if (skipDirs.has(e.name)) continue;
    cpSync(join(root, e.name), join(dist, e.name), { recursive: true });
  } else {
    if (skipFiles.has(e.name) || skipExts.has(extname(e.name))) continue;
    cpSync(join(root, e.name), join(dist, e.name));
  }
  count++;
}

for (const f of ['index.html', 'mobile.html']) {
  if (!existsSync(join(dist, f))) throw new Error(`build failed: ${f} missing from dist/`);
}
console.log(`dist/ ready (${count} top-level entries)`);
