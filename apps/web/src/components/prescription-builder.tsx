"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
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
const rxInputClass =
  "h-8 min-w-0 rounded-lg border border-border px-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary-light sm:h-9";

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

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-text-primary">Prescription</h4>

      <div ref={boxRef} className="relative space-y-2">
        <input
          className={`${rxInputClass} w-full`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search medicine…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Search medicine"
        />

        {open && (suggestions.length > 0 || loading || (query.trim().length < 2 && recent.length > 0)) ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-20 max-h-44 overflow-y-auto rounded-lg border border-border bg-surface shadow-card"
          >
            {query.trim().length < 2
              ? recent.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-primary-light"
                      onClick={() => selectMedicine(name)}
                    >
                      <span className="font-medium text-text-primary">{name}</span>
                      <span className="text-[11px] text-text-secondary">Recent</span>
                    </button>
                  </li>
                ))
              : null}
            {loading ? <li className="px-3 py-1.5 text-xs text-text-secondary">Searching…</li> : null}
            {!loading && query.trim().length >= 2 && suggestions.length === 0 ? (
              <li className="px-3 py-1.5 text-xs text-text-secondary">No match — add as free text.</li>
            ) : null}
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-primary-light"
                  onClick={() => selectMedicine(item.name)}
                >
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                  <span className="text-[11px] text-text-secondary">
                    {[item.salt, item.pack, item.manufacturer].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
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
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ${
                timing[slot.key] ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"
              }`}
            >
              {slot.label}
            </button>
          ))}
          <span className="text-[10px] tabular-nums text-text-disabled">{timingLabel(timing)}</span>
          {(
            [
              { id: "sos" as const, label: "SOS", active: sos, onClick: toggleSos, title: "As needed" },
              { id: "bf" as const, label: "BF", active: food === "BF", onClick: () => toggleFood("BF"), title: "Before food" },
              { id: "af" as const, label: "AF", active: food === "AF", onClick: () => toggleFood("AF"), title: "After food" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              title={chip.title}
              aria-pressed={chip.active}
              onClick={chip.onClick}
              className={`h-7 rounded-md px-1.5 text-[11px] font-semibold ${
                chip.active ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"
              }`}
            >
              {chip.label}
            </button>
          ))}
          {DURATION.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={duration === item.value}
              className={`h-7 min-w-7 rounded-md px-1.5 text-[11px] font-medium ${
                duration === item.value ? "bg-primary text-white" : "border border-border bg-surface text-text-primary"
              }`}
              onClick={() => setDuration((current) => (current === item.value ? "" : item.value))}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            className={`${rxInputClass} flex-1`}
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            placeholder="Note"
            aria-label="Extra note"
          />
          <button
            className={`${compactPrimaryButtonClass} shrink-0 whitespace-nowrap`}
            type="button"
            disabled={!query.trim()}
            onClick={() => addMedicine()}
          >
            {editingKey ? "Update" : "Add"}
          </button>
          {editingKey ? (
            <button type="button" className={`${compactButtonClass} shrink-0`} onClick={() => resetDraft()}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className={`flex items-center gap-2 px-2.5 py-1.5 ${editingKey === row.key ? "bg-primary-light/40" : ""}`}
            >
              <span className="w-4 shrink-0 text-[11px] font-semibold text-text-disabled">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{row.name || "Untitled"}</p>
                {row.notes ? <p className="truncate text-[11px] text-text-secondary">{row.notes}</p> : null}
              </div>
              <div className="flex shrink-0">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary-light"
                  aria-label="Edit medicine"
                  onClick={() => startEdit(row)}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-critical hover:bg-critical-bg"
                  aria-label="Remove medicine"
                  onClick={() => {
                    if (editingKey === row.key) resetDraft();
                    removeRow(row.key);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
