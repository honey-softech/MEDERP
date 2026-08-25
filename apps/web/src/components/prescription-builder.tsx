"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fieldClass, primaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";
import { parseMedications } from "@/lib/prescription-text";

type DrugSuggest = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
};

type RxRow = {
  key: string;
  name: string;
  notes: string;
};

const DURATION = [
  { value: "3 days", label: "3d" },
  { value: "5 days", label: "5d" },
  { value: "7 days", label: "7d" },
  { value: "10 days", label: "10d" },
] as const;
const RECENT_KEY = "mederp_recent_drugs";
const MAX_RECENT = 12;

type Timing = { m: boolean; a: boolean; n: boolean };

function timingLabel(t: Timing) {
  return `${t.m ? "1" : "0"}-${t.a ? "1" : "0"}-${t.n ? "1" : "0"}`;
}

function hasTiming(t: Timing) {
  return t.m || t.a || t.n;
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowsFromText(text: string): RxRow[] {
  const parsed = parseMedications(text);
  if (parsed.length === 0) return [];
  return parsed.map((row) => ({ key: newKey(), name: row.name, notes: row.notes }));
}

function textFromRows(rows: RxRow[]) {
  return rows
    .filter((row) => row.name.trim())
    .map((row) => {
      const name = row.name.trim();
      const notes = row.notes.trim();
      return notes ? `${name} || ${notes}` : name;
    })
    .join("\n");
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(name: string) {
  const next = [name, ...loadRecent().filter((item) => item.toLowerCase() !== name.toLowerCase())].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function PrescriptionBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [rows, setRows] = useState<RxRow[]>(() => rowsFromText(value));
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DrugSuggest[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState("");
  const [timing, setTiming] = useState<Timing>({ m: false, a: false, n: false });
  const [sos, setSos] = useState(false);
  const [food, setFood] = useState<"BF" | "AF" | "">("");
  const [duration, setDuration] = useState<(typeof DURATION)[number]["value"] | "">("");
  const [composerOpen, setComposerOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    const next = textFromRows(rows);
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync outward only when rows change
  }, [rows]);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      void fetch(`/api/medicines/suggest?q=${encodeURIComponent(q)}&limit=12`, { signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json()) as { items?: DrugSuggest[] };
          if (!controller.signal.aborted) {
            setSuggestions(Array.isArray(data.items) ? data.items : []);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 280);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const composedNotes = useMemo(() => {
    const parts = [
      draftNotes.trim(),
      hasTiming(timing) ? timingLabel(timing) : "",
      food,
      sos ? "SOS" : "",
      duration ? `for ${duration}` : "",
    ].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }, [draftNotes, timing, food, sos, duration]);

  /** Fill search field only — does not add to the prescription list. */
  function selectMedicine(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    suppressSearchRef.current = true;
    setQuery(trimmed);
    setSuggestions([]);
    setOpen(false);
  }

  function resetDraft() {
    suppressSearchRef.current = true;
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setDraftNotes("");
    setTiming({ m: false, a: false, n: false });
    setSos(false);
    setFood("");
    setDuration("");
    setEditingKey(null);
  }

  function addMedicine() {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (editingKey) {
      setRows((current) =>
        current.map((row) => (row.key === editingKey ? { ...row, name: trimmed, notes: composedNotes } : row)),
      );
    } else {
      setRows((current) => [...current, { key: newKey(), name: trimmed, notes: composedNotes }]);
      pushRecent(trimmed);
      setRecent(loadRecent());
    }
    resetDraft();
  }

  function startEdit(row: RxRow) {
    setComposerOpen(true);
    suppressSearchRef.current = true;
    setEditingKey(row.key);
    setQuery(row.name);
    setDraftNotes(row.notes);
    setTiming({ m: false, a: false, n: false });
    setSos(false);
    setFood("");
    setDuration("");
    setSuggestions([]);
    setOpen(false);
  }

  function toggleTiming(slot: keyof Timing) {
    setTiming((current) => ({ ...current, [slot]: !current[slot] }));
    setSos(false);
  }

  function toggleSos() {
    setSos((current) => {
      const next = !current;
      if (next) setTiming({ m: false, a: false, n: false });
      return next;
    });
  }

  function toggleFood(next: "BF" | "AF") {
    setFood((current) => (current === next ? "" : next));
  }

  function updateRow(key: string, patch: Partial<RxRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-border bg-app-bg/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-text-primary">Prescription</h4>
          <p className="mt-0.5 text-xs text-text-secondary">
            Search, set M–A–N timing (e.g. 1-0-1), pick days, then Add medicine.
          </p>
        </div>
        <ExpandToggle open={composerOpen} onToggle={() => setComposerOpen((v) => !v)} labelOpen="Hide search" labelClosed="Show search" />
      </div>

      {composerOpen ? (
      <div ref={boxRef} className="relative rounded-lg border border-border bg-app-bg p-3">
        <label className="block text-xs font-medium text-text-secondary">
          Search medicine
          <input
            className={fieldClass}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type at least 2 letters (name or salt)…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
          />
        </label>

        {open && (suggestions.length > 0 || loading || (query.trim().length < 2 && recent.length > 0)) ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-3 right-3 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-card"
          >
            {query.trim().length < 2
              ? recent.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-primary-light"
                      onClick={() => selectMedicine(name)}
                    >
                      <span className="font-medium text-text-primary">{name}</span>
                      <span className="text-xs text-text-secondary">Recent</span>
                    </button>
                  </li>
                ))
              : null}
            {loading ? <li className="px-3 py-2 text-xs text-text-secondary">Searching…</li> : null}
            {!loading && query.trim().length >= 2 && suggestions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-secondary">
                No catalog match. Select free text below, then click Add medicine.
              </li>
            ) : null}
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-primary-light"
                  onClick={() => selectMedicine(item.name)}
                >
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                  <span className="text-xs text-text-secondary">
                    {[item.salt, item.pack, item.manufacturer].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[7rem] flex-1 text-xs font-medium text-text-secondary">
              Extra note
              <input
                className={fieldClass}
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                placeholder="optional"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Timing (M–A–N)</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: "m" as const, label: "M", title: "Morning" },
                    { key: "a" as const, label: "A", title: "Afternoon" },
                    { key: "n" as const, label: "N", title: "Night" },
                  ] as const
                ).map((slot) => (
                  <button
                    key={slot.key}
                    type="button"
                    title={slot.title}
                    aria-pressed={timing[slot.key]}
                    onClick={() => toggleTiming(slot.key)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                      timing[slot.key]
                        ? "bg-primary text-white"
                        : "border border-border bg-surface text-text-secondary"
                    }`}
                  >
                    {timing[slot.key] ? "1" : "0"}
                    <span className="sr-only">{slot.title}</span>
                  </button>
                ))}
                <span className="px-0.5 text-xs text-text-disabled" aria-hidden>
                  =
                </span>
                <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums text-text-primary">
                  {timingLabel(timing)}
                </span>
                <button
                  type="button"
                  title="As needed"
                  aria-pressed={sos}
                  onClick={toggleSos}
                  className={`ml-1 h-9 rounded-md px-2 text-xs font-semibold ${
                    sos ? "bg-secondary text-white" : "border border-border bg-surface text-text-secondary"
                  }`}
                >
                  SOS
                </button>
                <button
                  type="button"
                  title="Before food"
                  aria-pressed={food === "BF"}
                  onClick={() => toggleFood("BF")}
                  className={`h-9 rounded-md px-2 text-xs font-semibold ${
                    food === "BF" ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"
                  }`}
                >
                  BF
                </button>
                <button
                  type="button"
                  title="After food"
                  aria-pressed={food === "AF"}
                  onClick={() => toggleFood("AF")}
                  className={`h-9 rounded-md px-2 text-xs font-semibold ${
                    food === "AF" ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"
                  }`}
                >
                  AF
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Days</span>
              <div className="flex items-center gap-1">
                {DURATION.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={duration === item.value}
                    className={`h-9 min-w-9 rounded-md px-2 text-xs font-medium ${
                      duration === item.value
                        ? "bg-primary text-white"
                        : "border border-border bg-surface text-text-primary"
                    }`}
                    onClick={() => setDuration((current) => (current === item.value ? "" : item.value))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-text-secondary">
            M morning · A afternoon · N night · BF before food · AF after food · SOS as needed
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className={primaryButtonClass}
            type="button"
            disabled={!query.trim()}
            onClick={() => addMedicine()}
          >
            {editingKey ? "Update medicine" : "Add medicine"}
          </button>
          {editingKey ? (
            <button
              type="button"
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-text-secondary hover:bg-surface"
              onClick={() => resetDraft()}
            >
              Cancel edit
            </button>
          ) : null}
          {composedNotes ? (
            <span className="text-xs text-text-secondary">
              Preview: <span className="font-medium text-text-primary">{composedNotes}</span>
            </span>
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">
          {rows.length === 0 ? "No medicines yet" : `${rows.length} medicine${rows.length === 1 ? "" : "s"}`}
        </p>
        {rows.length > 0 ? (
          <ExpandToggle open={listOpen} onToggle={() => setListOpen((v) => !v)} count={rows.length} />
        ) : null}
      </div>

      {listOpen && rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className={`flex flex-col gap-2 rounded-lg border bg-surface p-3 sm:flex-row sm:items-end ${
                editingKey === row.key ? "border-primary ring-1 ring-primary-light" : "border-border"
              }`}
            >
              <span className="w-6 shrink-0 text-xs font-semibold text-text-secondary sm:mb-2.5">{index + 1}.</span>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-text-secondary">
                  Medicine
                  <input
                    className={fieldClass}
                    value={row.name}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  />
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Dose / frequency / duration
                  <input
                    className={fieldClass}
                    value={row.notes}
                    onChange={(event) => updateRow(row.key, { notes: event.target.value })}
                    placeholder="1-0-1 AF for 5 days"
                  />
                </label>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary-light"
                  aria-label="Edit medicine"
                  title="Edit"
                  onClick={() => startEdit(row)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-critical/30 text-critical hover:bg-critical-bg"
                  aria-label="Remove medicine"
                  title="Remove"
                  onClick={() => {
                    if (editingKey === row.key) resetDraft();
                    removeRow(row.key);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
