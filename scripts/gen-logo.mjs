import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SRC = 'C:/Users/kenge/OneDrive/Desktop/Smart Rent.png';
const OUT = resolve('public', 'icons');
await mkdir(OUT, { recursive: true });

// Trim the surrounding white so the navy fills edge-to-edge.
const trimmed = await sharp(SRC).trim({ threshold: 30 }).png().toBuffer();

const sizes = [192, 256, 384, 512, 1024];
for (const size of sizes) {
  await sharp(trimmed).resize(size, size, { fit: 'cover' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve(OUT, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}

// Maskable (Android adaptive) + Apple touch + favicon + OG all from the same logo.
await sharp(trimmed).resize(512, 512, { fit: 'cover' }).png().toFile(resolve(OUT, 'maskable-512.png'));
await sharp(trimmed).resize(180, 180, { fit: 'cover' }).png().toFile(resolve('public', 'apple-touch-icon.png'));
await sharp(trimmed).resize(32, 32, { fit: 'cover' }).png().toFile(resolve('public', 'favicon-32.png'));
console.log('Done — icons regenerated from Smart Rent.png');
