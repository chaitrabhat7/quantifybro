// Draws the app icon (the plate-share ring on cream) as PNGs. No dependencies.
// Run: npm run icons
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CREAM = [0xff, 0xf6, 0xe5], INK = [0x16, 0x16, 0x16], LIME = [0xc6, 0xf4, 0x32];

function draw(size) {
  const px = Buffer.alloc(size * size * 3);
  const c = size / 2, outer = size * 0.34, inner = size * 0.2, edge = size * 0.025;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy);
    let col = CREAM;
    if (r <= outer + edge) col = INK;                       // black outline + track
    if (r > inner + edge && r < outer - edge) {
      const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);  // 0 at top, clockwise
      col = a < Math.PI * 1.4 ? LIME : INK;                 // lime arc = your share
    }
    if (r <= inner) col = CREAM;                            // plate centre
    px.set(col, (y * size + x) * 3);
  }
  return png(size, px);
}

function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), draw(s));
console.log('icons written to', out);
