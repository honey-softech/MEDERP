"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

type DraftLine = {
  key: string;
  itemId?: string;
  catalogDrugId?: string;
  name: string;
  genericName: string;
  manufacturer: string;
  barcode: string;
  unit: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  quantity: string;
  purchaseRate: string;
  mrp: string;
};

type SuggestStock = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  barcode: string | null;
  unit: string;
  source: "stock";
};

type SuggestCatalog = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  packSize: string | null;
  source: "catalog";
};

function emptyLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    genericName: "",
    manufacturer: "",
    barcode: "",
    unit: "tablet",
    batchNo: "",
    mfgDate: "",
    expiryDate: "",
    quantity: "",
    purchaseRate: "",
    mrp: "",
  };
}

export function PharmacyGrnForm() {
  const router = useRouter();
  const listId = useId();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<(SuggestStock | SuggestCatalog)[]>([]);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetch(`/api/pharmacy/items?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          const stock = Array.isArray(data.items) ? data.items : [];
          const catalog = Array.isArray(data.catalog) ? data.catalog : [];
          setSuggestions([...stock, ...catalog]);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function applyMedicine(targetKey: string, med: SuggestStock | SuggestCatalog) {
    if (med.source === "stock") {
      updateLine(targetKey, {
        itemId: med.id,
        catalogDrugId: undefined,
        name: med.name,
        genericName: med.genericName ?? "",
        manufacturer: med.manufacturer ?? "",
        barcode: med.barcode ?? "",
        unit: med.unit || "tablet",
      });
    } else {
      updateLine(targetKey, {
        itemId: undefined,
        catalogDrugId: med.id,
        name: med.name,
        genericName: med.genericName ?? "",
        manufacturer: med.manufacturer ?? "",
        unit: med.packSize?.toLowerCase().includes("ml") ? "ml" : "tablet",
      });
    }
    setSearch("");
    setSuggestions([]);
    setOpen(false);
  }

  async function onBarcodeEnter() {
    const code = scan.trim();
    if (!code) return;
    const response = await fetch(`/api/pharmacy/items?barcode=${encodeURIComponent(code)}`);
    const data = await response.json().catch(() => ({}));
    if (data.item) {
      const item = data.item as {
        id: string;
        name: string;
        genericName: string | null;
        manufacturer: string | null;
        barcode: string | null;
        unit: string;
      };
      setLines((current) => {
        const blank = current.find((line) => !line.name.trim());
        const key = blank?.key ?? current[0]?.key;
        if (!key) return current;
        return current.map((line) =>
          line.key === key
            ? {
                ...line,
                itemId: item.id,
                name: item.name,
                genericName: item.genericName ?? "",
                manufacturer: item.manufacturer ?? "",
                barcode: item.barcode ?? code,
                unit: item.unit || "tablet",
              }
            : line,
        );
      });
      setOk(`Loaded ${item.name} from barcode.`);
      setError("");
    } else {
      setLines((current) => {
        const blank = current.find((line) => !line.name.trim()) ?? current[0];
        if (!blank) return [...current, { ...emptyLine(), barcode: code }];
        return current.map((line) => (line.key === blank.key ? { ...line, barcode: code } : line));
      });
      setOk("Barcode not in stock yet — fill medicine details, then save GRN.");
    }
    setScan("");
    barcodeRef.current?.focus();
  }

  async function submit() {
    setPending(true);
    setError("");
    setOk("");
    const response = await fetch("/api/pharmacy/grn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName,
        invoiceNo,
        invoiceDate: invoiceDate || null,
        notes,
        lines: lines
          .filter((line) => line.name.trim())
          .map((line) => ({
            itemId: line.itemId,
            catalogDrugId: line.catalogDrugId,
            name: line.name,
            genericName: line.genericName,
            manufacturer: line.manufacturer,
            unit: line.unit,
            barcode: line.barcode || null,
            batchNo: line.batchNo,
            mfgDate: line.mfgDate || null,
            expiryDate: line.expiryDate,
            quantity: Number(line.quantity),
            purchaseRate: Number(line.purchaseRate),
            mrp: Number(line.mrp),
          })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not receive stock.");
      return;
    }
    setOk("Stock received. Inventory updated.");
    setLines([emptyLine()]);
    setInvoiceNo("");
    setNotes("");
    router.refresh();
    barcodeRef.current?.focus();
  }

  const activeKey = lines.find((line) => !line.name.trim())?.key ?? lines[0]?.key;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <h3 className="font-semibold text-text-primary">Scan or search</h3>
        <p className="mt-1 text-xs text-text-secondary">
          USB barcode scanners work as a keyboard — focus the scan box, scan, then fill batch/expiry/qty.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-text-secondary">
            Barcode scan
            <input
              ref={barcodeRef}
              className={fieldClass}
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onBarcodeEnter();
                }
              }}
              placeholder="Scan here and press Enter"
              autoComplete="off"
            />
          </label>
          <div className="relative">
            <label className="text-xs font-medium text-text-secondary">
              Search medicine / catalog
              <input
                className={fieldClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setOpen(true)}
                placeholder="Type 2+ letters…"
                autoComplete="off"
                aria-controls={listId}
              />
            </label>
            {open && suggestions.length > 0 && activeKey ? (
              <ul
                id={listId}
                className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-card"
              >
                {suggestions.map((item) => (
                  <li key={`${item.source}-${item.id}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-primary-light"
                      onClick={() => applyMedicine(activeKey, item)}
                    >
                      <span className="text-sm font-medium text-text-primary">{item.name}</span>
                      <span className="text-xs text-text-secondary">
                        {item.source === "stock" ? "In pharmacy" : "Catalog"}
                        {item.manufacturer ? ` · ${item.manufacturer}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-3">
        <label className="text-xs font-medium text-text-secondary">
          Supplier
          <input className={fieldClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Distributor name" />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Invoice no.
          <input className={fieldClass} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Invoice date
          <input className={fieldClass} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-text-secondary sm:col-span-3">
          Notes
          <input className={fieldClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </label>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={line.key} className="rounded-lg border border-border bg-surface p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text-secondary">Line {index + 1}</p>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-critical hover:underline"
                  onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-medium text-text-secondary sm:col-span-2">
                Medicine
                <input className={fieldClass} value={line.name} onChange={(e) => updateLine(line.key, { name: e.target.value })} required />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Batch no.
                <input className={fieldClass} value={line.batchNo} onChange={(e) => updateLine(line.key, { batchNo: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Expiry
                <input className={fieldClass} type="date" value={line.expiryDate} onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Qty
                <input className={fieldClass} type="number" min={1} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Purchase rate
                <input className={fieldClass} type="number" min={0} step="0.01" value={line.purchaseRate} onChange={(e) => updateLine(line.key, { purchaseRate: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                MRP
                <input className={fieldClass} type="number" min={0} step="0.01" value={line.mrp} onChange={(e) => updateLine(line.key, { mrp: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Mfg date
                <input className={fieldClass} type="date" value={line.mfgDate} onChange={(e) => updateLine(line.key, { mfgDate: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Barcode
                <input className={fieldClass} value={line.barcode} onChange={(e) => updateLine(line.key, { barcode: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Salt / generic
                <input className={fieldClass} value={line.genericName} onChange={(e) => updateLine(line.key, { genericName: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Manufacturer
                <input className={fieldClass} value={line.manufacturer} onChange={(e) => updateLine(line.key, { manufacturer: e.target.value })} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryButtonClass} onClick={() => setLines((current) => [...current, emptyLine()])}>
          Add line
        </button>
        <button type="button" className={primaryButtonClass} disabled={pending} onClick={() => void submit()}>
          {pending ? "Saving…" : "Receive stock (GRN)"}
        </button>
      </div>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
    </div>
  );
}
