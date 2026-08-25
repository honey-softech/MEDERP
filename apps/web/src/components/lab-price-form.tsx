"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass, primaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";

type PriceRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  defaultPrice: number;
  price: number;
  isOffered: boolean;
};

export function LabPriceForm({ initial }: { initial: PriceRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const grouped = useMemo(
    () =>
      rows.reduce<Record<string, PriceRow[]>>((acc, row) => {
        (acc[row.category] ??= []).push(row);
        return acc;
      }, {}),
    [rows],
  );

  const categories = Object.keys(grouped);

  function isOpen(category: string) {
    if (category in openCategories) return openCategories[category];
    return categories[0] === category;
  }

  function toggleCategory(category: string) {
    setOpenCategories((current) => ({
      ...current,
      [category]: !isOpen(category),
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/hospital/lab-prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices: rows.map((row) => ({ testId: row.id, price: row.price, isOffered: row.isOffered })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save prices.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {Object.entries(grouped).map(([category, items]) => {
        const open = isOpen(category);
        return (
          <section key={category} className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="min-w-0 truncate font-semibold text-text-primary">
                {category}
                <span className="ml-2 text-xs font-normal text-text-secondary">{items.length}</span>
              </h3>
              <ExpandToggle open={open} onToggle={() => toggleCategory(category)} count={items.length} />
            </div>
            {open ? (
              <div className="divide-y divide-border">
                {items.map((row) => (
                  <div key={row.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_8rem_6rem] sm:items-center">
                    <div>
                      <p className="font-medium text-text-primary">{row.name}</p>
                      <p className="text-xs text-text-secondary">
                        {row.code}
                        {row.description ? ` · ${row.description}` : ""} · default ₹{row.defaultPrice}
                      </p>
                    </div>
                    <label className="text-sm font-medium text-text-primary">
                      Price
                      <input
                        className={fieldClass}
                        type="number"
                        min={0}
                        step="1"
                        value={row.price}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) => (item.id === row.id ? { ...item, price: Number(event.target.value) } : item)),
                          )
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <input
                        type="checkbox"
                        checked={row.isOffered}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, isOffered: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      Offer
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-success">Prices saved. Reception will collect these amounts for doctor-ordered tests.</p>
      ) : null}
      <button className={primaryButtonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save lab prices"}
      </button>
    </form>
  );
}
