"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

type SimilarMedicine = {
  id: string;
  name: string;
  manufacturer: string | null;
  saltComposition: string | null;
  packSize: string | null;
  type: string | null;
  sameManufacturer: boolean;
};

export function AddMedicineForm() {
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [saltComposition, setSaltComposition] = useState("");
  const [packSize, setPackSize] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const [similar, setSimilar] = useState<SimilarMedicine[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [matchedExisting, setMatchedExisting] = useState<SimilarMedicine | null>(null);
  const [forceNew, setForceNew] = useState(false);

  useEffect(() => {
    if (matchedExisting) {
      setSimilar([]);
      setSearching(false);
      return;
    }

    const q = name.trim();
    if (q.length < 2) {
      setSimilar([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);

      const params = new URLSearchParams({ q, limit: "12" });
      if (manufacturer.trim()) params.set("manufacturer", manufacturer.trim());

      void fetch(`/api/platform/medicines?${params}`, { signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json()) as { items?: SimilarMedicine[] };
          if (controller.signal.aborted) return;
          const items = Array.isArray(data.items) ? data.items : [];
          setSimilar(items);
          if (items.length > 0 && !forceNew) setDropdownOpen(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSimilar([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [name, manufacturer, matchedExisting, forceNew]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectExisting(item: SimilarMedicine) {
    setMatchedExisting(item);
    setName(item.name);
    setManufacturer(item.manufacturer ?? "");
    setSaltComposition(item.saltComposition ?? "");
    setPackSize(item.packSize ?? "");
    setType(item.type ?? "");
    setSimilar([]);
    setDropdownOpen(false);
    setForceNew(false);
    setError("");
    setMessage("This medicine is already in the catalog — no need to add it again.");
  }

  function clearMatchAndAddNew() {
    setMatchedExisting(null);
    setForceNew(true);
    setMessage("");
    setError("");
    setDropdownOpen(false);
  }

  function resetForm() {
    setName("");
    setManufacturer("");
    setSaltComposition("");
    setPackSize("");
    setType("");
    setSimilar([]);
    setMatchedExisting(null);
    setForceNew(false);
    setDropdownOpen(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (matchedExisting) {
      setError("This medicine already exists. Clear the match or choose “Add as new” if it is a different product.");
      return;
    }

    setError("");
    setMessage("");
    setPending(true);
    const response = await fetch("/api/platform/medicines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, manufacturer, saltComposition, packSize, type }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not add medicine.");
      return;
    }
    setMessage(`Added ${data.medicine?.name ?? name} to the catalog.`);
    resetForm();
    router.refresh();
  }

  const showDropdown =
    dropdownOpen &&
    !matchedExisting &&
    name.trim().length >= 2 &&
    (searching || similar.length > 0);

  const sameBrand = similar.filter((item) => item.sameManufacturer);
  const otherBrand = similar.filter((item) => !item.sameManufacturer);

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="font-semibold">Add new medicine</h3>
      <p className="mt-1 text-sm text-slate-500">
        Use this for products newly in the market that are missing from the imported list. Similar names are shown so
        you do not add a duplicate — if it is truly different, you can still add it.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div ref={boxRef} className="relative sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700">
            Medicine name
            <input
              className={fieldClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setMatchedExisting(null);
                setForceNew(false);
                setMessage("");
                setDropdownOpen(true);
              }}
              onFocus={() => {
                if (similar.length > 0) setDropdownOpen(true);
              }}
              required
              autoComplete="off"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls={listId}
            />
          </label>

          {showDropdown ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              {searching ? <li className="px-3 py-2 text-xs text-slate-500">Checking catalog…</li> : null}
              {!searching && sameBrand.length > 0 ? (
                <li className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Same / similar manufacturer
                </li>
              ) : null}
              {sameBrand.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-teal-50"
                    onClick={() => selectExisting(item)}
                  >
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {[item.manufacturer, item.saltComposition, item.packSize, item.type]
                        .filter(Boolean)
                        .join(" · ") || "In catalog"}
                    </span>
                  </button>
                </li>
              ))}
              {!searching && otherBrand.length > 0 ? (
                <li className="border-b border-slate-100 border-t bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {manufacturer.trim() ? "Other manufacturers" : "Similar in catalog"}
                </li>
              ) : null}
              {otherBrand.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-teal-50"
                    onClick={() => selectExisting(item)}
                  >
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {[item.manufacturer, item.saltComposition, item.packSize, item.type]
                        .filter(Boolean)
                        .join(" · ") || "In catalog"}
                    </span>
                  </button>
                </li>
              ))}
              {!searching && similar.length > 0 ? (
                <li className="border-t border-slate-100">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm font-medium text-teal-800 hover:bg-teal-50"
                    onClick={() => {
                      setForceNew(true);
                      setDropdownOpen(false);
                      setMessage("None of those match — fill the rest and add as a new medicine.");
                    }}
                  >
                    Different product — add as new
                  </button>
                </li>
              ) : null}
              {!searching && similar.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-500">No similar medicine found — you can add this as new.</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Manufacturer
          <input
            className={fieldClass}
            value={manufacturer}
            onChange={(e) => {
              setManufacturer(e.target.value);
              setMatchedExisting(null);
              setForceNew(false);
              setMessage("");
            }}
            placeholder="Narrows similar matches"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Type
          <input
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Tablet, Syrup, Injection…"
            disabled={Boolean(matchedExisting)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Salt / composition
          <input
            className={fieldClass}
            value={saltComposition}
            onChange={(e) => setSaltComposition(e.target.value)}
            placeholder="e.g. Paracetamol 500mg"
            disabled={Boolean(matchedExisting)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Pack size
          <input
            className={fieldClass}
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            placeholder="e.g. strip of 10"
            disabled={Boolean(matchedExisting)}
          />
        </label>
      </div>

      {matchedExisting ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Already in catalog. If this is a <span className="font-medium">different</span> product (new strength, pack,
          or brand line), continue as new.
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={clearMatchAndAddNew}>
              Different — add as new
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                resetForm();
                setMessage("");
              }}
            >
              Clear form
            </button>
          </div>
        </div>
      ) : null}

      {forceNew && !matchedExisting && similar.length > 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Adding as a new medicine even though similar names exist. Double-check manufacturer and strength.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      <button className={`${buttonClass} mt-4`} type="submit" disabled={pending || Boolean(matchedExisting)}>
        {pending ? "Adding…" : matchedExisting ? "Already in catalog" : "Add medicine"}
      </button>
    </form>
  );
}
