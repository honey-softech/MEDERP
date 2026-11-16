import { SCRIBE_MAX_TRANSCRIPT_CHARS } from "@/lib/scribe/limits";

export type TranscriptSegment = {
  id: string;
  seq: number;
  original: string;
  english: string;
};

/** Finished lines stay in order. The live line is one replaceable buffer, so a word does not rebuild the whole note. */
export type TranscriptStore = {
  byId: Map<string, TranscriptSegment>;
  order: string[];
  original: string;
  english: string;
  chars: number;
  interimId: string | null;
  interim: string;
};

export function createTranscriptStore(): TranscriptStore {
  return {
    byId: new Map(),
    order: [],
    original: "",
    english: "",
    chars: 0,
    interimId: null,
    interim: "",
  };
}

function appendLine(current: string, line: string) {
  const next = line.trim();
  if (!next) return current;
  return current ? `${current}\n${next}` : next;
}

function rememberInterim(store: TranscriptStore) {
  const line = store.interim.trim();
  const id = store.interimId;
  store.interim = "";
  store.interimId = null;
  if (!line || !id || store.byId.has(id)) return;
  if (store.chars >= SCRIBE_MAX_TRANSCRIPT_CHARS) return;
  store.byId.set(id, { id, seq: 0, original: line, english: "" });
  store.order.push(id);
  store.original = appendLine(store.original, line).slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  store.chars += line.length;
}

/** Replace the grey live line. A new id keeps the previous live line instead of dropping it. */
export function replaceInterim(store: TranscriptStore, id: string, text: string) {
  if (store.interimId && store.interimId !== id) rememberInterim(store);
  store.interimId = id;
  store.interim = text;
  return store;
}

export function appendInterimDelta(store: TranscriptStore, id: string, delta: string) {
  if (store.interimId && store.interimId !== id) rememberInterim(store);
  if (store.interimId !== id) {
    store.interimId = id;
    store.interim = "";
  }
  store.interim += delta;
  return store;
}

/** Commit a finished sentence once. A repeated id is ignored. */
export function commitSegment(store: TranscriptStore, input: TranscriptSegment) {
  if (store.byId.has(input.id)) return { store, duplicate: true };
  if (store.chars >= SCRIBE_MAX_TRANSCRIPT_CHARS) return { store, duplicate: false, full: true as const };
  if (store.interimId === input.id) {
    store.interim = "";
    store.interimId = null;
  }
  const original = input.original.trim();
  const english = input.english.trim();
  store.byId.set(input.id, { id: input.id, seq: input.seq, original, english });
  store.order.push(input.id);
  store.original = appendLine(store.original, original).slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  store.english = appendLine(store.english, english).slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  store.chars += original.length + english.length;
  return { store, duplicate: false, full: false as const };
}

export function seedTranscript(store: TranscriptStore, original: string, english: string) {
  const spoken = original.trim();
  const translated = english.trim();
  if (!spoken && !translated) return store;
  if (store.byId.has("seed")) return store;
  store.byId.set("seed", { id: "seed", seq: 0, original: spoken, english: translated });
  store.order.unshift("seed");
  store.original = spoken.slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  store.english = translated.slice(0, SCRIBE_MAX_TRANSCRIPT_CHARS);
  store.chars = store.original.length + store.english.length;
  return store;
}
