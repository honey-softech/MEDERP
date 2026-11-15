import { describe, expect, it } from "vitest";
import {
  approveBlockReason,
  pagesReadyToStore,
  parseEntryMode,
  pngSize,
  readHandwritingPages,
  serializeHandwritingPages,
  validateHandwritingPages,
} from "@/lib/handwriting";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("handwritten assessment pages", () => {
  it("drops blank exports and reloads the saved pages", () => {
    const stored = pagesReadyToStore([null, "", TINY_PNG, "not-an-image"]);
    expect(stored).toEqual([TINY_PNG]);
    const serialized = serializeHandwritingPages(stored);
    expect(readHandwritingPages(serialized)).toEqual([TINY_PNG]);
  });

  it("rejects pages that are not PNG data URLs", () => {
    const result = validateHandwritingPages(["data:image/jpeg;base64,aaaa"]);
    expect(result.ok).toBe(false);
  });

  it("reads a JSON page list stored on the assessment", () => {
    expect(readHandwritingPages(JSON.stringify([TINY_PNG]))).toEqual([TINY_PNG]);
    expect(readHandwritingPages("not-json")).toEqual([]);
  });

  it("requires a diagnosis only for typed approval", () => {
    expect(
      approveBlockReason({ entryMode: "TYPED", diagnosis: "", handwritingPages: [] }),
    ).toBe("Add a diagnosis before approving.");
    expect(
      approveBlockReason({ entryMode: "TYPED", diagnosis: "URTI", handwritingPages: [] }),
    ).toBeNull();
    expect(
      approveBlockReason({ entryMode: "HANDWRITTEN", diagnosis: "", handwritingPages: [] }),
    ).toBe("Write on the sheet before approving.");
    expect(
      approveBlockReason({ entryMode: "HANDWRITTEN", diagnosis: "", handwritingPages: [TINY_PNG] }),
    ).toBeNull();
  });

  it("parses the entry mode", () => {
    expect(parseEntryMode("handwritten")).toBe("HANDWRITTEN");
    expect(parseEntryMode("nope")).toBe("TYPED");
  });

  it("reads the size of an exported PNG page", () => {
    const buffer = Buffer.from(TINY_PNG.slice(TINY_PNG.indexOf(",") + 1), "base64");
    expect(pngSize(buffer)).toEqual({ width: 1, height: 1 });
  });
});
