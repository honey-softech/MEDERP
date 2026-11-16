import { describe, expect, it } from "vitest";
import {
  appendInterimDelta,
  commitSegment,
  createTranscriptStore,
  replaceInterim,
  seedTranscript,
} from "@/lib/scribe/transcript-store";

describe("transcript store", () => {
  it("replaces the live line in place and commits it once", () => {
    const store = createTranscriptStore();
    appendInterimDelta(store, "item-1", "head");
    appendInterimDelta(store, "item-1", "ache");
    expect(store.interim).toBe("headache");
    expect(store.original).toBe("");

    const first = commitSegment(store, { id: "item-1", seq: 1, original: "headache", english: "headache" });
    const again = commitSegment(store, { id: "item-1", seq: 1, original: "headache", english: "headache" });
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(store.order).toEqual(["item-1"]);
    expect(store.english).toBe("headache");
    expect(store.interim).toBe("");
  });

  it("keeps sentence order when a new live line starts", () => {
    const store = createTranscriptStore();
    replaceInterim(store, "item-1", "fever");
    appendInterimDelta(store, "item-2", "for ");
    appendInterimDelta(store, "item-2", "two days");
    expect(store.original).toBe("fever");
    expect(store.interim).toBe("for two days");
    commitSegment(store, { id: "item-2", seq: 2, original: "for two days", english: "for two days" });
    expect(store.order).toEqual(["item-1", "item-2"]);
    expect(store.english).toBe("for two days");
  });

  it("seeds an earlier recording without duplicating it", () => {
    const store = createTranscriptStore();
    seedTranscript(store, "thalavali", "headache");
    seedTranscript(store, "other", "other");
    expect(store.original).toBe("thalavali");
    expect(store.english).toBe("headache");
    expect(store.chars).toBe("thalavali".length + "headache".length);
  });
});
