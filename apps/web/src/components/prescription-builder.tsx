"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
import { ensureDrugCatalogCache } from "@/lib/drug-catalog-cache";
import { DRUG_FORM_FILTERS } from "@/lib/drug-catalog-cache/search";
import { parseMedications } from "@/lib/prescription-text";

type DrugSuggest = {
  id: string;
  name: string;
  salt: string | null;
  pack: string | null;
  manufacturer: string | null;
};

type SuggestResponse = {
  items?: DrugSuggest[];
  preferred?: DrugSuggest[];
  other?: DrugSuggest[];
  preferredManufacturers?: string[];
  canManagePreferred?: boolean;
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
const filterClass =
  "h-7 max-w-[9.5rem] rounded-md border border-border bg-surface px-1.5 text-[11px] text-text-primary outline-none focus:border-primary";

type Timing = { m: boolean; a: boolean; n: boolean };
type ManufacturerFilter = "boost" | "preferred" | "all" | string;

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

function SuggestRow({
  item,
  preferred,
  canStar,
  starring,
  onSelect,
  onStar,
}: {
  item: DrugSuggest;
  preferred?: boolean;
  canStar: boolean;
  starring: boolean;
  onSelect: () => void;
  onStar: () => void;
}) {
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start px-3 py-1.5 text-left hover:bg-primary-light"
        onClick={onSelect}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
          {preferred ? <span className="text-[11px] text-amber-600" aria-hidden>★</span> : null}
          {item.name}
        </span>
        <span className="text-[11px] text-text-secondary">
          {[item.salt, item.pack, item.manufacturer].filter(Boolean).join(" · ")}
        </span>
      </button>
      {canStar && item.manufacturer && !preferred ? (
        <button
          type="button"
          className="shrink-0 px-2 text-[11px] text-text-secondary hover:bg-primary-light hover:text-primary"
          title={`Add ${item.manufacturer} to preferred`}
          aria-label={`Add ${item.manufacturer} to preferred manufacturers`}
          disabled={starring}
          onClick={(event) => {
            event.stopPropagation();
            onStar();
          }}
        >
          ☆
        </button>
      ) : null}
    </li>
  );
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
  const [preferredHits, setPreferredHits] = useState<DrugSuggest[]>([]);
  const [otherHits, setOtherHits] = useState<DrugSuggest[]>([]);
  const [preferredManufacturers, setPreferredManufacturers] = useState<string[]>([]);
  const [canManagePreferred, setCanManagePreferred] = useState(false);
  const [manufacturerFilter, setManufacturerFilter] = useState<ManufacturerFilter>("boost");
  const [formFilter, setFormFilter] = useState("");
  const [strengthFilter, setStrengthFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starringManufacturer, setStarringManufacturer] = useState<string | null>(null);
  const [starMessage, setStarMessage] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
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

  const suggestions = useMemo(() => [...preferredHits, ...otherHits], [preferredHits, otherHits]);

  useEffect(() => {
    setRecent(loadRecent());
    void ensureDrugCatalogCache();
  }, []);

  useEffect(() => {
    const next = textFromRows(rows);
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync outward only when rows change
  }, [rows]);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      setPreferredHits([]);
      setOtherHits([]);
      setSearchError("");
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setPreferredHits([]);
      setOtherHits([]);
      setSearchError("");
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setSearchError("");
      void (async () => {
        try {
          // Always hit the API on web; local IndexedDB cache is mobile-only.
          const params = new URLSearchParams({ q, limit: "12" });
          if (manufacturerFilter) params.set("manufacturer", manufacturerFilter);
          if (formFilter) params.set("form", formFilter);
          if (strengthFilter.trim()) params.set("strength", strengthFilter.trim());

          const response = await fetch(`/api/medicines/suggest?${params}`, {
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => ({}))) as SuggestResponse & { error?: string };
          if (controller.signal.aborted) return;

          if (!response.ok) {
            setPreferredHits([]);
            setOtherHits([]);
            setSearchError(data.error ?? "Medicine search failed. Try again.");
            setOpen(true);
            return;
          }

          setPreferredHits(Array.isArray(data.preferred) ? data.preferred : []);
          setOtherHits(Array.isArray(data.other) ? data.other : Array.isArray(data.items) ? data.items : []);
          if (Array.isArray(data.preferredManufacturers)) {
            setPreferredManufacturers(data.preferredManufacturers);
          }
          if (typeof data.canManagePreferred === "boolean") {
            setCanManagePreferred(data.canManagePreferred);
          }
          setOpen(true);
        } catch (error) {
          if (!controller.signal.aborted) {
            setPreferredHits([]);
            setOtherHits([]);
            // Aborts throw; ignore those. Network/parse errors should surface.
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              setSearchError("Medicine search failed. Try again.");
              setOpen(true);
            }
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // preferredManufacturers only used for local cache sectioning; API returns sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchNonce forces refresh after starring a brand
  }, [query, manufacturerFilter, formFilter, strengthFilter, searchNonce]);

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
    setPreferredHits([]);
    setOtherHits([]);
    setSearchError("");
    setOpen(false);
  }

  function resetDraft() {
    suppressSearchRef.current = true;
    setQuery("");
    setPreferredHits([]);
    setOtherHits([]);
    setSearchError("");
    setOpen(false);
    setDraftNotes("");
    setTiming({ m: false, a: false, n: false });
    setSos(false);
    setFood("");
    setDuration("");
    setEditingKey(null);
    setStarMessage("");
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
    setPreferredHits([]);
    setOtherHits([]);
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

  async function starManufacturer(name: string) {
    setStarringManufacturer(name);
    setStarMessage("");
    try {
      const response = await fetch("/api/hospital/drug-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturerName: name }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        alreadyPreferred?: boolean;
        manufacturer?: { name: string };
      };
      if (!response.ok) {
        setStarMessage(data.error ?? "Could not add preferred brand.");
        return;
      }
      const addedName = data.manufacturer?.name ?? name;
      setPreferredManufacturers((current) =>
        current.some((item) => item.toLowerCase() === addedName.toLowerCase())
          ? current
          : [...current, addedName],
      );
      setStarMessage(data.alreadyPreferred ? `${addedName} is already preferred.` : `Added ${addedName} to preferred.`);
      setSearchNonce((value) => value + 1);
    } finally {
      setStarringManufacturer(null);
    }
  }

  const showDropdown =
    open &&
    (suggestions.length > 0 ||
      loading ||
      Boolean(searchError) ||
      (query.trim().length < 2 && recent.length > 0) ||
      starMessage ||
      (query.trim().length >= 2 && !loading));

  return (
    <div className="space-y-2">
      <div ref={boxRef} className="relative space-y-2">
        <div className="relative">
          <input
            className={`${rxInputClass} w-full`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setStarMessage("");
              setSearchError("");
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search medicine… e.g. Paracetamol 500 tablet"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label="Search medicine"
          />

          {showDropdown ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-card"
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
              {searchError ? <li className="px-3 py-1.5 text-xs text-critical">{searchError}</li> : null}
              {!loading && !searchError && query.trim().length >= 2 && suggestions.length === 0 ? (
                <li className="px-3 py-1.5 text-xs text-text-secondary">No match — add as free text.</li>
              ) : null}
              {starMessage ? (
                <li className="border-b border-border px-3 py-1.5 text-[11px] text-success">{starMessage}</li>
              ) : null}
              {preferredHits.length > 0 ? (
                <li className="sticky top-0 bg-app-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  Preferred
                </li>
              ) : null}
              {preferredHits.map((item) => (
                <SuggestRow
                  key={`p-${item.id}`}
                  item={item}
                  preferred
                  canStar={false}
                  starring={false}
                  onSelect={() => selectMedicine(item.name)}
                  onStar={() => undefined}
                />
              ))}
              {otherHits.length > 0 ? (
                <li className="sticky top-0 bg-app-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  {preferredHits.length > 0 ? `Other results (${otherHits.length})` : "Results"}
                </li>
              ) : null}
              {otherHits.map((item) => (
                <SuggestRow
                  key={`o-${item.id}`}
                  item={item}
                  canStar={canManagePreferred}
                  starring={starringManufacturer === item.manufacturer}
                  onSelect={() => selectMedicine(item.name)}
                  onStar={() => {
                    if (item.manufacturer) void starManufacturer(item.manufacturer);
                  }}
                />
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`${listId}-mfr`}>
            Manufacturer filter
          </label>
          <select
            id={`${listId}-mfr`}
            className={filterClass}
            value={manufacturerFilter}
            onChange={(event) => setManufacturerFilter(event.target.value)}
          >
            <option value="boost">★ Preferred first</option>
            <option value="preferred">Preferred only</option>
            <option value="all">All manufacturers</option>
            {preferredManufacturers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`${listId}-form`}>
            Dosage form
          </label>
          <select
            id={`${listId}-form`}
            className={filterClass}
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value)}
          >
            <option value="">Any form</option>
            {DRUG_FORM_FILTERS.map((form) => (
              <option key={form} value={form}>
                {form.charAt(0).toUpperCase() + form.slice(1)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`${listId}-strength`}>
            Strength
          </label>
          <input
            id={`${listId}-strength`}
            className={filterClass}
            value={strengthFilter}
            onChange={(event) => setStrengthFilter(event.target.value)}
            placeholder="Strength e.g. 500mg"
            list={`${listId}-strengths`}
          />
          <datalist id={`${listId}-strengths`}>
            <option value="250mg" />
            <option value="500mg" />
            <option value="650mg" />
            <option value="40mg" />
            <option value="10mg" />
          </datalist>
        </div>

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
