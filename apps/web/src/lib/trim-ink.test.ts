import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pngSize } from "@/lib/handwriting";
import { trimInkDataUrl } from "@/lib/trim-ink";

describe("trim handwritten ink", () => {
  it("drops the blank page around a short note", () => {
    const width = 40;
    const height = 80;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 10; y < 14; y += 1) {
      for (let x = 8; x < 18; x += 1) {
        const index = (y * width + x) * 4;
        rgba[index] = 20;
        rgba[index + 1] = 20;
        rgba[index + 2] = 20;
        rgba[index + 3] = 255;
      }
    }
    const trimmed = trimInkDataUrl(pngDataUrl(rgba, width, height), 2);
    const size = pngSize(Buffer.from(trimmed.slice(trimmed.indexOf(",") + 1), "base64"));
    expect(size).toEqual({ width: 14, height: 8 });
  });

  it("leaves a page that is already full of ink unchanged in size", () => {
    const rgba = Buffer.alloc(4 * 4);
    rgba.fill(255);
    const source = pngDataUrl(rgba, 2, 2);
    const trimmed = trimInkDataUrl(source, 0);
    const size = pngSize(Buffer.from(trimmed.slice(trimmed.indexOf(",") + 1), "base64"));
    expect(size).toEqual({ width: 2, height: 2 });
  });
});

function pngDataUrl(rgba: Buffer, width: number, height: number) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}
