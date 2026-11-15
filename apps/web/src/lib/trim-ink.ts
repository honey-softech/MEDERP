import { deflateSync, inflateSync } from "node:zlib";
import { pngSize } from "@/lib/handwriting";

/** Keep a little paper around the writing when the blank page is trimmed. */
const TRIM_PADDING = 28;

/**
 * Crop a transparent handwriting PNG to the ink, so a few lines do not
 * reserve a full blank page on the visit summary.
 * The stored page stays full-size so the writing pad can reopen it in place.
 */
export function trimInkDataUrl(dataUrl: string, padding = TRIM_PADDING): string {
  if (!dataUrl.startsWith("data:image/png;base64,")) return dataUrl;
  const source = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  const image = decodePng(source);
  if (!image) return dataUrl;
  const bounds = opaqueBounds(image);
  if (!bounds) return dataUrl;
  const left = Math.max(0, bounds.minX - padding);
  const top = Math.max(0, bounds.minY - padding);
  const right = Math.min(image.width - 1, bounds.maxX + padding);
  const bottom = Math.min(image.height - 1, bounds.maxY + padding);
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width >= image.width * 0.92 && height >= image.height * 0.92) return dataUrl;
  const cropped = encodePng(image.rgba, image.width, left, top, width, height);
  if (cropped.length < 32) return dataUrl;
  return `data:image/png;base64,${cropped.toString("base64")}`;
}

type RgbaImage = { width: number; height: number; rgba: Buffer };

function decodePng(buffer: Buffer): RgbaImage | null {
  if (buffer.length < 8 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const end = offset + 8 + length;
    if (end + 4 > buffer.length) return null;
    const data = buffer.subarray(offset + 8, end);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }
  if (bitDepth !== 8 || width < 1 || height < 1 || idat.length === 0) return null;
  const channels = channelsFor(colorType);
  if (!channels) return null;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = width * channels;
  if (inflated.length < height * (stride + 1)) return null;
  const rgba = Buffer.alloc(width * height * 4);
  const previous = Buffer.alloc(stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = Buffer.from(inflated.subarray(src, src + stride));
    src += stride;
    unfilter(filter, row, previous, channels);
    previous.set(row);
    for (let x = 0; x < width; x += 1) {
      const dst = (y * width + x) * 4;
      const i = x * channels;
      if (channels === 4) {
        rgba[dst] = row[i];
        rgba[dst + 1] = row[i + 1];
        rgba[dst + 2] = row[i + 2];
        rgba[dst + 3] = row[i + 3];
      } else if (channels === 3) {
        rgba[dst] = row[i];
        rgba[dst + 1] = row[i + 1];
        rgba[dst + 2] = row[i + 2];
        rgba[dst + 3] = 255;
      } else if (channels === 2) {
        rgba[dst] = row[i];
        rgba[dst + 1] = row[i];
        rgba[dst + 2] = row[i];
        rgba[dst + 3] = row[i + 1];
      } else {
        rgba[dst] = row[i];
        rgba[dst + 1] = row[i];
        rgba[dst + 2] = row[i];
        rgba[dst + 3] = 255;
      }
    }
  }
  return { width, height, rgba };
}

function channelsFor(colorType: number) {
  if (colorType === 6) return 4;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 0) return 1;
  return 0;
}

function unfilter(filter: number, row: Buffer, previous: Buffer, channels: number) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= channels ? row[index - channels] : 0;
    const up = previous[index];
    const upLeft = index >= channels ? previous[index - channels] : 0;
    if (filter === 1) row[index] = (row[index] + left) & 255;
    else if (filter === 2) row[index] = (row[index] + up) & 255;
    else if (filter === 3) row[index] = (row[index] + ((left + up) >> 1)) & 255;
    else if (filter === 4) row[index] = (row[index] + paeth(left, up, upLeft)) & 255;
  }
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function opaqueBounds(image: RgbaImage) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.rgba[(y * image.width + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function encodePng(rgba: Buffer, sourceWidth: number, left: number, top: number, width: number, height: number) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    const src = ((top + y) * sourceWidth + left) * 4;
    rgba.copy(raw, rowStart + 1, src, src + stride);
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
  return pngSize(png) ? png : Buffer.alloc(0);
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
