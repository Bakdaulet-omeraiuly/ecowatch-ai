// Synthetic test containers; never used as application data.
export const textBytes = (value: string) => new TextEncoder().encode(value);
export function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
export function jpegSegment(marker: number, payload: Uint8Array) {
  return concat(new Uint8Array([255, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255]), payload);
}
export const jpegScan = new Uint8Array([255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 12, 34, 255, 0, 56, 255, 217]);
export const jpegWithGps = () => concat(new Uint8Array([255, 216]),
  jpegSegment(0xe0, textBytes("JFIF\0")), jpegSegment(0xe1, textBytes("Exif\0\0GPS +47.1167+051.9014")), jpegScan);

export function pngChunk(type: string, payload: Uint8Array) {
  const out = new Uint8Array(12 + payload.length);
  new DataView(out.buffer).setUint32(0, payload.length);
  out.set(textBytes(type), 4); out.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, out.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  new DataView(out.buffer).setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}
export function riffChunk(type: string, payload: Uint8Array) {
  const out = new Uint8Array(8 + payload.length + (payload.length % 2));
  out.set(textBytes(type)); new DataView(out.buffer).setUint32(4, payload.length, true); out.set(payload, 8);
  return out;
}
export function box(type: string, payload: Uint8Array, extended = false, toEnd = false) {
  const header = extended ? 16 : 8;
  const out = new Uint8Array(header + payload.length);
  const data = new DataView(out.buffer);
  data.setUint32(0, extended ? 1 : toEnd ? 0 : out.length);
  out.set(textBytes(type), 4);
  if (extended) data.setBigUint64(8, BigInt(out.length));
  out.set(payload, header);
  return out;
}
