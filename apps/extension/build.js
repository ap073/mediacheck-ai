const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  const srcDir = path.join(__dirname, 'src');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('Building TypeScript background and popup scripts...');

  // Bundle background service worker
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'background.ts')],
    bundle: true,
    outfile: path.join(distDir, 'background.js'),
    format: 'esm',
    target: ['chrome100'],
    minify: false,
    sourcemap: true,
  });

  // Bundle popup script
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'popup.ts')],
    bundle: true,
    outfile: path.join(distDir, 'popup.js'),
    format: 'iife',
    target: ['chrome100'],
    minify: false,
    sourcemap: true,
  });

  // Copy static assets
  const staticFiles = ['manifest.json', 'popup.html', 'popup.css'];
  for (const file of staticFiles) {
    const src = path.join(srcDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy icons
  const srcIcons = path.join(srcDir, 'icons');
  const destIcons = path.join(distDir, 'icons');
  if (fs.existsSync(srcIcons)) {
    fs.mkdirSync(destIcons, { recursive: true });
    for (const icon of fs.readdirSync(srcIcons)) {
      fs.copyFileSync(path.join(srcIcons, icon), path.join(destIcons, icon));
    }
  }

  console.log('Chrome extension built successfully in apps/extension/dist/');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
