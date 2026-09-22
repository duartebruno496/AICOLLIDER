import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---------- PNG encoding (sem dependências) ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      const o = rowStart + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- Desenho: fundo escuro + "A" em losango ----------
const BK = [13, 22, 37]; // #0d1625
const SKY = [56, 189, 248]; // #38bdf8
const EMERALD = [52, 211, 153]; // #34d399

function inGlyph(x, y, W, H) {
  const cx = 0.5;
  const legW = 0.06 * W;
  const leftX = (y / H - 0.14) / 0.72; // normalized 0..1 along the A height
  const halfW = (0.5 - legW / 2 / W) * W;
  const isLeftLeg = x > (0.5 - (y / H - 0.14) * 0.42) * W - legW / 2 && x < (0.5 - (y / H - 0.14) * 0.42) * W + legW / 2;
  const isRightLeg = x > (0.5 + (y / H - 0.14) * 0.42) * W - legW / 2 && x < (0.5 + (y / H - 0.14) * 0.42) * W + legW / 2;
  const inRay = y >= 0.14 * H && y <= 0.86 * H && (isLeftLeg || isRightLeg);
  const inBar = y >= 0.44 * H && y <= 0.56 * H && x > (0.5 - 0.16) * W && x < (0.5 + 0.16) * W;
  void cx;
  void halfW;
  const leftLegAt = (0.5 - (0.5 / H - 0.14) * 0.42) * W;
  const rightLegAt = (0.5 + (0.5 / H - 0.14) * 0.42) * W;
  const barrel = y >= 0.46 * H && y <= 0.56 * H && x > leftLegAt && x < rightLegAt;
  return inRay || barrel;
}

function drawIcon(size) {
  return encodePng(size, size, (x, y, W, H) => {
    if (inGlyph(x, y, W, H)) {
      return y >= 0.46 * H && y <= 0.56 * H ? EMERALD : SKY;
    }
    return BK;
  });
}

writeFileSync(join(OUT, "icon-192.png"), drawIcon(192));
writeFileSync(join(OUT, "icon-512.png"), drawIcon(512));
writeFileSync(join(OUT, "icon-512-maskable.png"), drawIcon(512));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0d1625"/>
  <polygon points="256,96 128,416 196,416 256,240 316,416 384,416" fill="#38bdf8"/>
  <rect x="196" y="290" width="120" height="46" rx="8" fill="#34d399"/>
</svg>`;
writeFileSync(join(OUT, "icon.svg"), svg);

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0d1625"/><polygon points="32,8 12,56 30,56 40,28 50,56 52,56" fill="#38bdf8"/></svg>`;
writeFileSync(join(OUT, "favicon.svg"), favicon);

console.log("Ícones gerados em", OUT);