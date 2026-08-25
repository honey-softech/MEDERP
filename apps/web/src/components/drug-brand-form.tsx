"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";

type Brand = { id: string; name: string; medicineCount: number };

const CHIP_PREVIEW = 6;
const LIST_PREVIEW = 8;

function IconPlus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

function IconTrash({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
    </svg>
  );
}

function IconPencil({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function IconPill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8.5 8.5a4.5 4.5 0 0 1 6.4 6.4l-6.4-6.4z" />
      <path d="M15.5 15.5a4.5 4.5 0 0 1-6.4-6.4l6.4 6.4z" />
      <path d="M9.5 9.5l5 5" />
    </svg>
  );
}

export function DrugBrandForm({
  initialSelected,
  initialSuggestions,
}: {
  initialSelected: Brand[];
  initialSuggestions: Brand[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Brand[]>(initialSelected);
  const [suggestions, setSuggestions] = useState<Brand[]>(initialSuggestions);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(initialSelected.length === 0);
  const [pending, setPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [chipsOpen, setChipsOpen] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(false);

  const selectedIds = useMemo(() => new Set(selected.map((b) => b.id)), [selected]);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const response = await fetch(`/api/hospital/drug-brands?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as { suggestions?: Brand[]; error?: string };
      if (response.ok) setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      void search(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search, editing]);

  function toggle(brand: Brand) {
    if (!editing) return;
    setSaved(false);
    setSelected((current) => {
      if (current.some((item) => item.id === brand.id)) {
        return current.filter((item) => item.id !== brand.id);
      }
      return [...current, brand].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function save() {
    setPending(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/hospital/drug-brands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manufacturerIds: selected.map((item) => item.id) }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save brands.");
      return;
    }
    setSaved(true);
    setEditing(false);
    router.refresh();
  }

  function cancelEdit() {
    setSelected(initialSelected);
    setQuery("");
    setError("");
    setSaved(false);
    setEditing(false);
  }

  const listRows = useMemo(() => {
    const map = new Map<string, Brand>();
    for (const brand of suggestions) map.set(brand.id, brand);
    for (const brand of selected) {
      if (!map.has(brand.id) && query.trim().length < 2) map.set(brand.id, brand);
    }
    return [...map.values()].sort((a, b) => {
      const aOn = selectedIds.has(a.id) ? 0 : 1;
      const bOn = selectedIds.has(b.id) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return b.medicineCount - a.medicineCount || a.name.localeCompare(b.name);
    });
  }, [suggestions, selected, selectedIds, query]);

  const visibleChips =
    chipsExpanded || selected.length <= CHIP_PREVIEW ? selected : selected.slice(0, CHIP_PREVIEW);
  const visibleRows =
    catalogExpanded || listRows.length <= LIST_PREVIEW ? listRows : listRows.slice(0, LIST_PREVIEW);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-text-primary">Preferred brands</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {selected.length === 0
                ? "None selected — doctors see the full Indian catalog."
                : `${selected.length} brand${selected.length === 1 ? "" : "s"} active for prescription search.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selected.length > 0 ? (
              <ExpandToggle
                open={chipsOpen}
                onToggle={() => setChipsOpen((v) => !v)}
                count={selected.length}
              />
            ) : null}
            {!editing ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary-light"
                aria-label="Edit brands"
                title="Edit brands"
                onClick={() => {
                  setEditing(true);
                  setCatalogOpen(true);
                }}
              >
                <IconPencil />
              </button>
            ) : (
              <>
                <button className={secondaryButtonClass} type="button" onClick={cancelEdit}>
                  Cancel
                </button>
                <button className={primaryButtonClass} type="button" disabled={pending} onClick={() => void save()}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        {chipsOpen ? (
          selected.length > 0 ? (
            <>
              <ul className="mt-3 flex flex-wrap gap-2">
                {visibleChips.map((brand) => (
                  <li
                    key={brand.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-light py-1 pl-2.5 pr-1 text-xs font-medium text-primary-dark"
                  >
                    <IconPill className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{brand.name}</span>
                    {editing ? (
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-critical hover:bg-critical-bg"
                        aria-label={`Remove ${brand.name}`}
                        title="Remove"
                        onClick={() => toggle(brand)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-success" title="Added">
                        <IconCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {selected.length > CHIP_PREVIEW ? (
                <div className="mt-2">
                  <ExpandToggle
                    open={chipsExpanded}
                    onToggle={() => setChipsExpanded((v) => !v)}
                    labelOpen="Show fewer"
                    labelClosed="Show all brands"
                    count={selected.length}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              {editing ? "Pick brands from the list below." : "Tap the pencil to choose brands for this hospital."}
            </p>
          )
        ) : null}
      </div>

      {editing ? (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Manufacturer catalog</h3>
            <ExpandToggle open={catalogOpen} onToggle={() => setCatalogOpen((v) => !v)} count={listRows.length} />
          </div>

          {catalogOpen ? (
            <>
              <label className="block text-sm font-medium text-text-primary">
                Search manufacturers
                <input
                  className={fieldClass}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCatalogExpanded(true);
                  }}
                  placeholder="e.g. Cipla, Sun, Abbott…"
                />
              </label>
              <p className="mt-1 text-xs text-text-secondary">
                {query.trim().length < 2
                  ? "Top brands by catalog size. Type 2+ letters to search all manufacturers."
                  : searching
                    ? "Searching…"
                    : `${listRows.length} matches`}
              </p>

              <ul className="mt-3 max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {visibleRows.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-text-secondary">No manufacturers to show.</li>
                ) : (
                  visibleRows.map((brand) => {
                    const added = selectedIds.has(brand.id);
                    return (
                      <li key={brand.id} className={added ? "bg-primary-light/40" : undefined}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              added ? "bg-success-bg text-success" : "bg-app-bg text-text-secondary"
                            }`}
                          >
                            {added ? <IconCheck /> : <IconPill />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-text-primary">{brand.name}</span>
                            <span className="text-xs text-text-secondary">
                              {brand.medicineCount.toLocaleString()} medicines
                            </span>
                          </span>
                          <button
                            type="button"
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                              added
                                ? "border-critical/30 text-critical hover:bg-critical-bg"
                                : "border-border text-primary hover:bg-primary-light"
                            }`}
                            aria-label={added ? `Remove ${brand.name}` : `Add ${brand.name}`}
                            title={added ? "Remove" : "Add"}
                            onClick={() => toggle(brand)}
                          >
                            {added ? <IconTrash /> : <IconPlus />}
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              {listRows.length > LIST_PREVIEW ? (
                <div className="mt-2">
                  <ExpandToggle
                    open={catalogExpanded}
                    onToggle={() => setCatalogExpanded((v) => !v)}
                    labelOpen="Show fewer"
                    labelClosed="Show more brands"
                    count={listRows.length}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {saved ? <p className="text-sm text-success">Brands saved. Doctor search will use this list.</p> : null}
    </div>
  );
}
