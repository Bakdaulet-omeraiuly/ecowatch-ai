// Минималды PNG декодер: 8-бит сұр (color type 0), interlace жоқ — Sentinel Hub
// Process API UINT8 бір арналы шығысы үшін. Сыртқы кітапхана қажет емес.
import { inflateSync } from "node:zlib";

export function decodeGrayPng(buf: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) throw new Error("PNG емес");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 8, width = 0, height = 0;
  const idat: Uint8Array[] = [];
  while (off < buf.length) {
    const len = dv.getUint32(off), type = String.fromCharCode(...buf.subarray(off + 4, off + 8));
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = dv.getUint32(off + 8); height = dv.getUint32(off + 12);
      const [depth, color, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || color !== 0 || interlace !== 0) throw new Error(`PNG пішімі қолдауда жоқ (depth ${depth}, color ${color})`);
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(width * height);
  let prev = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width + 1)];
    const line = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
    const cur = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      const a = x ? cur[x - 1] : 0, b = prev[x], c = x ? prev[x - 1] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = (line[x] + p) & 255;
    }
    data.set(cur, y * width);
    prev = cur;
  }
  return { width, height, data };
}
