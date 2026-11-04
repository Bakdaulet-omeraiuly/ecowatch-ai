import { describe, expect, it } from "vitest";
import { sniffMedia, stripMetadata } from "./mediaSanitize";
import { box, concat, jpegScan, jpegSegment, jpegWithGps, pngChunk, riffChunk, textBytes } from "./test/mediaFixtures";

const text = (b: Uint8Array) => new TextDecoder().decode(b);
describe("P3.4 metadata removal", () => {
  it("JPEG strips EXIF/GPS/comments, keeps JFIF, ICC, Adobe and the scan bytes", () => {
    const input = concat(jpegWithGps().subarray(0, -jpegScan.length), jpegSegment(0xe2, textBytes("ICC_PROFILE\0colour")),
      jpegSegment(0xee, textBytes("Adobe")), jpegSegment(0xfe, textBytes("GPS comment")), jpegScan);
    const out = stripMetadata(input, "image/jpeg");
    expect(text(out)).not.toMatch(/Exif|GPS/);
    expect(text(out)).toContain("JFIF"); expect(text(out)).toContain("ICC_PROFILE"); expect(text(out)).toContain("Adobe");
    expect([...out.subarray(0, 2)]).toEqual([255, 216]);
    expect(out.subarray(-jpegScan.length)).toEqual(jpegScan);
    expect(sniffMedia(input)).toBe("image/jpeg");
  });
  it("PNG strips metadata but copies image chunks and CRCs verbatim", () => {
    const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = pngChunk("IHDR", new Uint8Array(13));
    const idat = pngChunk("IDAT", new Uint8Array([1, 2, 3]));
    const end = pngChunk("IEND", new Uint8Array());
    const input = concat(header, ihdr, ...["eXIf", "tEXt", "zTXt", "iTXt", "tIME"].map((type) => pngChunk(type, textBytes("GPS"))), idat, end);
    expect(sniffMedia(input)).toBe("image/png");
    expect(stripMetadata(input, "image/png")).toEqual(concat(header, ihdr, idat, end));
    expect(() => stripMetadata(input.subarray(0, -1), "image/png")).toThrow();
  });
  it("WebP removes EXIF/XMP, clears flags and updates RIFF size", () => {
    const input = concat(textBytes("RIFF0000WEBP"), riffChunk("VP8X", new Uint8Array([0x1c, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
      riffChunk("EXIF", textBytes("GPS")), riffChunk("XMP ", textBytes("location")), riffChunk("VP8 ", new Uint8Array([1, 2, 3])));
    new DataView(input.buffer).setUint32(4, input.length - 8, true);
    expect(sniffMedia(input)).toBe("image/webp");
    const out = stripMetadata(input, "image/webp");
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    expect(out[20]).toBe(0x10); expect(text(out)).not.toMatch(/EXIF|XMP |GPS|location/);
    expect(() => stripMetadata(input.subarray(0, -1), "image/webp")).toThrow();
  });
  it.each([false, true])("MP4/MOV handles extended=%s and size-0 boxes without moving mdat or stco", (extended) => {
    const coordinate = "+47.1167+051.9014/";
    const ftyp = box("ftyp", textBytes(extended ? "qt  0000" : "isom0000"));
    const moov = box("moov", concat(box("udta", box("©xyz", textBytes(coordinate)), extended),
      box("trak", concat(box("meta", textBytes("GPS location"), extended), box("stco", new Uint8Array([0, 0, 0, 32]))))), extended);
    const mdat = box("mdat", new Uint8Array([3, 1, 4, 1, 5]), false, true);
    const input = concat(ftyp, moov, mdat);
    const type = extended ? "video/quicktime" : "video/mp4";
    expect(sniffMedia(input)).toBe(type);
    const out = stripMetadata(input, type);
    expect(out).toHaveLength(input.length);
    expect(text(out)).not.toContain(coordinate); expect(text(out)).not.toMatch(/GPS|location/);
    expect(out.subarray(-mdat.length)).toEqual(mdat);
    const offset = text(input).indexOf("stco");
    expect(out.subarray(offset, offset + 8)).toEqual(input.subarray(offset, offset + 8));
    expect(text(out)).toContain("free");
  });
  it("rejects garbage, mismatched types and truncated structures", () => {
    expect(sniffMedia(textBytes("not media"))).toBeNull();
    expect(() => stripMetadata(jpegWithGps().subarray(0, 20), "image/jpeg")).toThrow();
    expect(() => stripMetadata(jpegWithGps(), "image/png")).toThrow();
    const malformed = concat(box("ftyp", textBytes("isom0000")), new Uint8Array([0, 0, 0, 1, 109, 111, 111, 118]));
    expect(() => stripMetadata(malformed, "video/mp4")).toThrow();
  });
});
