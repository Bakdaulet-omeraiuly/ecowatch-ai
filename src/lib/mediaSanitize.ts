// Container parsing only: no raw upload is stored if its structure is invalid.
export type MediaType = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/quicktime";
const ascii = (b: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...b.subarray(start, start + length));
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const invalid = (): never => { throw new Error("Malformed media container"); };
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

export function sniffMedia(b: Uint8Array): MediaType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && pngSignature.every((value, i) => b[i] === value)) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (b.length >= 16 && ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (brand === "qt  ") return "video/quicktime";
    if (/^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(brand)) return "video/mp4";
  }
  return null;
}

function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function jpeg(b: Uint8Array) {
  const parts = [b.subarray(0, 2)];
  let pos = 2;
  while (pos < b.length) {
    const start = pos;
    if (b[pos++] !== 0xff) invalid();
    while (b[pos] === 0xff) pos++;
    const marker = b[pos++];
    if (pos + 2 > b.length || marker === 0 || marker === 0xd8 || marker === 0xd9) invalid();
    const length = view(b).getUint16(pos);
    if (length < 2 || pos + length > b.length) invalid();
    const end = pos + length;
    if (marker === 0xda) {
      // A complete scan must terminate in EOI; preserve compressed image bytes.
      if (length < 6 || end + 2 > b.length || b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) invalid();
      parts.push(b.subarray(start));
      return join(parts);
    }
    const keepICC = marker === 0xe2 && ascii(b, pos + 2, 12) === "ICC_PROFILE\0";
    const keepAdobe = marker === 0xee && ascii(b, pos + 2, 5) === "Adobe";
    if (!(marker >= 0xe1 && marker <= 0xef) && marker !== 0xfe || keepICC || keepAdobe) {
      parts.push(b.subarray(start, end));
    }
    pos = end;
  }
  return invalid();
}

function png(b: Uint8Array) {
  const parts = [b.subarray(0, 8)];
  let pos = 8;
  let hasData = false;
  while (pos < b.length) {
    if (pos + 12 > b.length) invalid();
    const length = view(b).getUint32(pos);
    const type = ascii(b, pos + 4, 4);
    const end = pos + 12 + length;
    if (end > b.length || (pos === 8 && (type !== "IHDR" || length !== 13))) invalid();
    if (type === "IDAT") hasData = true;
    if (!["eXIf", "tEXt", "zTXt", "iTXt", "tIME"].includes(type)) parts.push(b.subarray(pos, end));
    if (type === "IEND") {
      if (length !== 0 || !hasData || end !== b.length) invalid();
      return join(parts);
    }
    pos = end;
  }
  return invalid();
}

function webp(b: Uint8Array) {
  if (view(b).getUint32(4, true) !== b.length - 8) invalid();
  const parts = [b.slice(0, 12)];
  let pos = 12;
  let hasData = false;
  while (pos < b.length) {
    if (pos + 8 > b.length) invalid();
    const length = view(b).getUint32(pos + 4, true);
    const end = pos + 8 + length + (length % 2);
    if (end > b.length) invalid();
    const type = ascii(b, pos, 4);
    if (["VP8 ", "VP8L", "ANMF"].includes(type) && length > 0) hasData = true;
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = b.slice(pos, end);
      if (type === "VP8X") {
        if (length !== 10) invalid();
        chunk[8] &= ~(0x08 | 0x04);
      }
      parts.push(chunk);
    }
    pos = end;
  }
  if (!hasData) invalid();
  const out = join(parts);
  view(out).setUint32(4, out.length - 8, true);
  return out;
}

function movie(b: Uint8Array) {
  const out = b.slice();
  const data = view(out);
  let hasMovie = false;
  let hasData = false;
  const walk = (start: number, end: number, depth: number) => {
    if (depth > 32) invalid();
    let pos = start;
    while (pos < end) {
      if (pos + 8 > end) invalid();
      let size = data.getUint32(pos);
      let header = 8;
      if (size === 1) {
        if (pos + 16 > end) invalid();
        const largeSize = data.getBigUint64(pos + 8);
        if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
        size = Number(largeSize);
        header = 16;
      } else if (size === 0) size = end - pos;
      if (size < header || pos + size > end) invalid();
      const type = ascii(out, pos + 4, 4);
      if (depth === 0 && type === "moov") hasMovie = true;
      if (depth === 0 && type === "mdat" && size > header) hasData = true;
      if (type === "udta" || type === "meta") {
        out.set([102, 114, 101, 101], pos + 4); // free: leave all sample offsets intact
        out.fill(0, pos + header, pos + size);
      } else if (["moov", "trak", "mdia", "minf", "stbl", "edts", "moof", "traf"].includes(type)) {
        walk(pos + header, pos + size, depth + 1);
      }
      pos += size;
    }
  };
  walk(0, out.length, 0);
  if (!hasMovie || !hasData) invalid();
  return out;
}

export function stripMetadata(bytes: Uint8Array, type: MediaType): Uint8Array {
  if (sniffMedia(bytes) !== type) invalid();
  switch (type) {
    case "image/jpeg": return jpeg(bytes);
    case "image/png": return png(bytes);
    case "image/webp": return webp(bytes);
    case "video/mp4":
    case "video/quicktime": return movie(bytes);
  }
}
