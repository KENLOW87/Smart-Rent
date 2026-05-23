import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('public', 'icons');
await mkdir(OUT, { recursive: true });

// Crisp, modern app icon: blue→indigo gradient + white house with key hole + "SR"
const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12"/>
      <feOffset dx="0" dy="14" result="o"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="1024" height="1024" rx="220" ry="220" fill="url(#bg)"/>

  <!-- House silhouette in white -->
  <g filter="url(#shadow)" transform="translate(220,250)">
    <!-- Roof + body -->
    <path d="M 292 0 L 0 240 L 60 240 L 60 500 L 524 500 L 524 240 L 584 240 Z"
          fill="#ffffff"/>
    <!-- Door (dark accent) -->
    <rect x="232" y="320" width="120" height="180" rx="10" fill="#2563eb"/>
    <!-- Door knob -->
    <circle cx="332" cy="410" r="8" fill="#ffffff"/>
    <!-- Window left -->
    <rect x="110" y="290" width="90" height="90" rx="10" fill="#4338ca"/>
    <!-- Window right -->
    <rect x="384" y="290" width="90" height="90" rx="10" fill="#4338ca"/>
  </g>
</svg>
`;

const sizes = [192, 256, 384, 512, 1024];
for (const size of sizes) {
  const out = resolve(OUT, `icon-${size}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${out}`);
}

// Apple touch icon (rounded handled by iOS so we provide square)
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(resolve('public', 'apple-touch-icon.png'));

// Favicon (32x32)
await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(resolve('public', 'favicon-32.png'));

// Maskable icon (extra padding for Android adaptive icons)
const maskable = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(290,320)">
    <path d="M 222 0 L 0 180 L 45 180 L 45 380 L 399 380 L 399 180 L 444 180 Z" fill="#ffffff"/>
    <rect x="176" y="240" width="92" height="140" rx="8" fill="#2563eb"/>
    <circle cx="252" cy="316" r="6" fill="#ffffff"/>
    <rect x="84" y="220" width="68" height="68" rx="8" fill="#4338ca"/>
    <rect x="292" y="220" width="68" height="68" rx="8" fill="#4338ca"/>
  </g>
</svg>
`;
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(resolve(OUT, 'maskable-512.png'));

console.log('Done.');
