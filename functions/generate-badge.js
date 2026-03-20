/**
 * Generates badge-96.png — a white bar-chart icon on transparent background.
 * Used as the notification badge (Android status bar icon).
 *
 * Usage: node functions/generate-badge.js
 * Output: badge-96.png in repo root
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 96, H = 96;

// ── PNG encoder (pure Node.js, no dependencies) ──────────────────────────────

function buildPNG(width, height, rgba) {
  // CRC-32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(td));
    return Buffer.concat([lenBuf, td, crcBuf]);
  }

  // Add filter byte (0 = None) at start of each scanline
  const rowLen = width * 4;
  const raw = Buffer.alloc(height * (rowLen + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (rowLen + 1)] = 0;
    rgba.copy(raw, y * (rowLen + 1) + 1, y * rowLen, (y + 1) * rowLen);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Draw icon ────────────────────────────────────────────────────────────────

const buf = Buffer.alloc(W * H * 4, 0); // all transparent

function px(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 255; // solid white
}

function rect(x, y, w, h) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      px(x + dx, y + dy);
}

function circle(cx, cy, r) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y);
}

function ring(cx, cy, r, thickness) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d >= r - thickness && d <= r) px(cx + x, cy + y);
    }
}

// Design: 3 ascending bars inside a circle outline
// Circle border
ring(48, 48, 44, 5);

// 3 bars (ascending left→right) centered inside the circle
// Available area roughly x:14–82, y:14–82 (inside circle)
const barW = 14, gap = 6;
const totalW = 3 * barW + 2 * gap; // 54
const startX = Math.round((W - totalW) / 2); // 21

const barHeights = [26, 36, 48];
const baseY = 70;

for (let i = 0; i < 3; i++) {
  const x = startX + i * (barW + gap);
  const h = barHeights[i];
  rect(x, baseY - h, barW, h);
}

// Base line
rect(startX - 2, baseY + 2, totalW + 4, 4);

// ── Write file ────────────────────────────────────────────────────────────────

const out = path.join(__dirname, '..', 'badge-96.png');
fs.writeFileSync(out, buildPNG(W, H, buf));
console.log('✅ Created badge-96.png');
