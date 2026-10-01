// Static "build": copies only the files the app loads into dist/ so that
// internal material (docs, reference PDFs/PPTX, tools, launchers) is never
// served. No dependencies, no bundling - the app is plain HTML/CSS/JS.
import { cpSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// --out <dir> overrides the output folder (relative to the cwd); default is <repo>/dist
const outIdx = process.argv.indexOf('--out');
const dist = outIdx > -1 ? resolve(process.cwd(), process.argv[outIdx + 1]) : join(root, 'dist');

const skipDirs = new Set(['dist', 'docs', 'reference', 'tools', 'scripts', 'node_modules']);
const skipFiles = new Set(['package.json', 'package-lock.json']);
const skipExts = new Set(['.md', '.bat', '.ps1', '.py', '.pyc']);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

let count = 0;
for (const e of readdirSync(root, { withFileTypes: true })) {
  if (e.name.startsWith('.')) continue; // .git, .claude, .htaccess, .gitignore
  if (e.isDirectory()) {
    if (skipDirs.has(e.name)) continue;
    cpSync(join(root, e.name), join(dist, e.name), { recursive: true });
  } else {
    if (skipFiles.has(e.name) || skipExts.has(extname(e.name))) continue;
    cpSync(join(root, e.name), join(dist, e.name));
  }
  count++;
}

// serve.json must ship: it turns off `cleanUrls` (whose 301 drops the ?screen= query the
// driver app reads) and restores `/` -> index.html. Without it the deploy regresses. See DEPLOY.md.
for (const f of ['index.html', 'mobile.html', 'serve.json']) {
  if (!existsSync(join(dist, f))) throw new Error(`build failed: ${f} missing from dist/`);
}
console.log(`dist/ ready (${count} top-level entries)`);
