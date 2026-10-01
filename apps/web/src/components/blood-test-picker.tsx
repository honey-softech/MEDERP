"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass, fieldClass, compactButtonClass, compactPrimaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";
import { SCAN_MODALITIES, type InvestigationPick, type ScanTabId } from "@/lib/lab-catalog";

export type LabTestOption = {
  id: string;
  code: string;
  name: string;
  category: string;
  kind?: "BLOOD" | "SCAN";
  description: string | null;
  price: number;
};

type TabId = "blood" | ScanTabId | "other";

const TABS: { id: TabId; label: string }[] = [
  { id: "blood", label: "Blood tests" },
  { id: "xray", label: "X-ray" },
  { id: "ct", label: "CT" },
  { id: "mri", label: "MRI" },
  { id: "other", label: "Other" },
];

const USG_PARTS = ["Abdomen", "Pelvis", "KUB", "Obstetric", "Thyroid", "Breast", "Scrotum", "Soft tissue"];

const FOLLOW_UP_QUICK = [
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
];

function addDaysIso(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickKey(testId: string, siteLabel?: string | null) {
  return `${testId}::${String(siteLabel ?? "").trim()}`;
}

function samePick(a: InvestigationPick, b: InvestigationPick) {
  return pickKey(a.testId, a.siteLabel) === pickKey(b.testId, b.siteLabel);
}

export function BloodTestPicker({
  selectedIds,
  selectedInvestigations,
  onChange,
  onInvestigationsChange,
  locked = false,
  labEnabled = true,
  priorOrderCount = 0,
  printHref = "",
  variant = "card",
  followUpAt = "",
  onFollowUpAtChange,
}: {
  selectedIds?: string[];
  selectedInvestigations?: InvestigationPick[];
  onChange?: (ids: string[]) => void;
  onInvestigationsChange?: (items: InvestigationPick[]) => void;
  locked?: boolean;
  labEnabled?: boolean;
  patientPhone?: string | null;
  priorOrderCount?: number;
  compact?: boolean;
  printHref?: string;
  /** toolbar = header action button before Start consult */
  variant?: "card" | "toolbar";
  followUpAt?: string;
  onFollowUpAtChange?: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("blood");
  const [tests, setTests] = useState<LabTestOption[]>([]);
  const [search, setSearch] = useState("");
  const [customPart, setCustomPart] = useState("");
  const [draftFollowUpAt, setDraftFollowUpAt] = useState(followUpAt);
  const initialPicks = selectedInvestigations ?? (selectedIds ?? []).map((testId) => ({ testId }));
  const [draft, setDraft] = useState<InvestigationPick[]>(initialPicks);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDraft(selectedInvestigations ?? (selectedIds ?? []).map((testId) => ({ testId })));
  }, [selectedIds, selectedInvestigations]);

  useEffect(() => {
    setDraftFollowUpAt(followUpAt);
  }, [followUpAt]);

  useEffect(() => {
    void fetch("/api/lab/tests")
      .then((response) => response.json())
      .then((data) => setTests(Array.isArray(data.tests) ? data.tests : []));
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const byCode = useMemo(() => new Map(tests.map((test) => [test.code, test])), [tests]);
  const bloodTests = useMemo(() => tests.filter((test) => test.kind !== "SCAN"), [tests]);
  const otherScans = useMemo(
    () => tests.filter((test) => test.kind === "SCAN" && !["XRAY", "CT", "MRI"].includes(test.code)),
    [tests],
  );

  const groupedBlood = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = bloodTests.filter((test) => {
      if (!query) return true;
      return [test.name, test.code, test.category, test.description ?? ""].join(" ").toLowerCase().includes(query);
    });
    const map = new Map<string, LabTestOption[]>();
    for (const test of filtered) {
      const list = map.get(test.category) ?? [];
      list.push(test);
      map.set(test.category, list);
    }
    return [...map.entries()];
  }, [search, bloodTests]);

  const selectedLines = draft
    .map((pick) => {
      const test = tests.find((row) => row.id === pick.testId);
      if (!test) return null;
      const site = String(pick.siteLabel ?? "").trim();
      return { key: pickKey(pick.testId, pick.siteLabel), label: site ? `${test.name} · ${site}` : test.name };
    })
    .filter((row): row is { key: string; label: string } => Boolean(row));

  function emit(next: InvestigationPick[]) {
    setDraft(next);
    onInvestigationsChange?.(next);
    onChange?.([...new Set(next.map((pick) => pick.testId))]);
  }

  function hasPick(testId: string, siteLabel?: string | null) {
    return draft.some((pick) => samePick(pick, { testId, siteLabel }));
  }

  function toggleBlood(testId: string) {
    setDraft((current) =>
      current.some((pick) => pick.testId === testId && !pick.siteLabel)
        ? current.filter((pick) => !(pick.testId === testId && !pick.siteLabel))
        : [...current, { testId }],
    );
  }

  function toggleSite(testId: string, siteLabel: string) {
    setDraft((current) =>
      current.some((pick) => samePick(pick, { testId, siteLabel }))
        ? current.filter((pick) => !samePick(pick, { testId, siteLabel }))
        : [...current, { testId, siteLabel }],
    );
  }

  function addCustom(testId: string) {
    const siteLabel = customPart.trim();
    if (!siteLabel || !testId) return;
    setDraft((current) => (current.some((pick) => samePick(pick, { testId, siteLabel })) ? current : [...current, { testId, siteLabel }]));
    setCustomPart("");
  }

  function isCategoryOpen(category: string, index: number) {
    if (search.trim()) return true;
    if (category in openCategories) return openCategories[category];
    return index === 0;
  }

  function confirmSelection() {
    emit(draft);
    if (onFollowUpAtChange && draft.length > 0) {
      const nextDate = draftFollowUpAt || followUpAt || addDaysIso(7);
      setDraftFollowUpAt(nextDate);
      onFollowUpAtChange(nextDate);
    }
    setOpen(false);
  }

  const activeModality = SCAN_MODALITIES.find((row) => row.tab === tab);
  const activeScanTest = activeModality ? byCode.get(activeModality.code) : undefined;
  const usgTest = byCode.get("USG");
  const showFollowUp = Boolean(onFollowUpAtChange);

  const modal = open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/40 p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tests-picker-title"
            className="relative z-[1] flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-border bg-surface shadow-card sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div>
                  <h3 id="tests-picker-title" className="text-lg font-semibold text-text-primary">Select tests and scans</h3>
                  <p className="mt-0.5 text-sm text-text-secondary">{draft.length} selected</p>
                </div>
                <button className={secondaryButtonClass} type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1 overflow-x-auto bg-app-bg px-3 py-2 sm:px-5">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                      tab === item.id ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                    }`}
                    onClick={() => {
                      setTab(item.id);
                      setSearch("");
                      setCustomPart("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
              {tab === "blood" ? (
                <>
                  <input
                    className={fieldClass}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search CBC, thyroid, dengue…"
                  />
                  <div className="mt-3 space-y-3 pr-1">
                    {groupedBlood.map(([category, items], index) => {
                      const catOpen = isCategoryOpen(category, index);
                      return (
                        <section key={category} className="overflow-hidden rounded-lg border border-border">
                          <div className="flex items-center justify-between gap-2 bg-app-bg px-3 py-2">
                            <h4 className="min-w-0 truncate text-sm font-semibold text-primary-dark">{category}</h4>
                            <ExpandToggle
                              open={catOpen}
                              onToggle={() =>
                                setOpenCategories((current) => ({
                                  ...current,
                                  [category]: !catOpen,
                                }))
                              }
                              count={items.length}
                            />
                          </div>
                          {catOpen ? (
                            <ul className="grid gap-2 p-3 sm:grid-cols-2">
                              {items.map((test) => {
                                const checked = hasPick(test.id);
                                return (
                                  <li key={test.id}>
                                    <label
                                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                                        checked ? "border-primary bg-primary-light" : "border-border bg-surface"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleBlood(test.id)}
                                        className="mt-1"
                                      />
                                      <span>
                                        <span className="block font-medium text-text-primary">{test.name}</span>
                                        {test.description ? (
                                          <span className="mt-0.5 block text-xs text-text-secondary">{test.description}</span>
                                        ) : null}
                                        <span className="mt-1 block text-xs text-text-secondary">
                                          {test.code}
                                          {labEnabled ? ` · ₹${test.price.toLocaleString("en-IN")}` : ""}
                                        </span>
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                </>
              ) : tab === "other" ? (
                <div className="space-y-4 pr-1">
                  {usgTest ? (
                    <ScanPartGrid
                      title="Ultrasound — which area?"
                      test={usgTest}
                      parts={USG_PARTS}
                      labEnabled={labEnabled}
                      selected={draft}
                      onToggle={toggleSite}
                      customPart={customPart}
                      onCustomPart={setCustomPart}
                      onAddCustom={() => addCustom(usgTest.id)}
                    />
                  ) : null}
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {otherScans
                      .filter((test) => test.code !== "USG")
                      .map((test) => {
                        const checked = hasPick(test.id);
                        return (
                          <li key={test.id}>
                            <label
                              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                                checked ? "border-primary bg-primary-light" : "border-border bg-surface"
                              }`}
                            >
                              <input type="checkbox" checked={checked} onChange={() => toggleBlood(test.id)} className="mt-1" />
                              <span>
                                <span className="block font-medium text-text-primary">{test.name}</span>
                                <span className="mt-1 block text-xs text-text-secondary">
                                  {test.code}
                                  {labEnabled ? ` · ₹${test.price.toLocaleString("en-IN")}` : ""}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : activeModality && activeScanTest ? (
                <ScanPartGrid
                  title={`${activeModality.name} — which part?`}
                  hint={`Select every region that needs ${activeModality.name}. Add a custom part if it is not listed.`}
                  test={activeScanTest}
                  parts={activeModality.parts}
                  labEnabled={labEnabled}
                  selected={draft}
                  onToggle={toggleSite}
                  customPart={customPart}
                  onCustomPart={setCustomPart}
                  onAddCustom={() => addCustom(activeScanTest.id)}
                />
              ) : (
                <p className="text-sm text-text-secondary">This scan type is not available yet.</p>
              )}
              </div>

              <div className="shrink-0 space-y-3 border-t border-border bg-surface px-4 py-3 sm:px-5">
                {showFollowUp && draft.length > 0 ? (
                  <div className="rounded-lg border border-border bg-app-bg/70 px-3 py-2.5">
                    <p className="text-xs font-semibold text-text-primary">Follow-up to review results</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">
                      When the patient returns, reception can add them to the queue with prior vitals and the last
                      assessment sheet for the doctor.
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <label className="min-w-[9rem] flex-1 text-[11px] font-medium text-text-secondary">
                        Follow-up date
                        <input
                          className={`${fieldClass} mt-1`}
                          type="date"
                          value={draftFollowUpAt}
                          onChange={(event) => setDraftFollowUpAt(event.target.value)}
                        />
                      </label>
                      <div className="flex flex-wrap gap-1 pb-0.5">
                        {FOLLOW_UP_QUICK.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary hover:bg-app-bg"
                            onClick={() => setDraftFollowUpAt(addDaysIso(item.days))}
                          >
                            +{item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => {
                      emit([]);
                      setDraftFollowUpAt(followUpAt);
                      setSearch("");
                      setCustomPart("");
                    }}
                  >
                    Reset
                  </button>
                  <button className={primaryButtonClass} type="button" onClick={confirmSelection}>
                    Add selected
                  </button>
                </div>
              </div>
            </div>
        </div>
      ) : null;

  if (variant === "toolbar") {
    const label = locked
      ? "Tests / scans"
      : draft.length
        ? `Tests / scans (${draft.length})`
        : priorOrderCount > 0
          ? "Tests / scans · more"
          : "Tests / scans";
    return (
      <>
        <div className="inline-flex items-center gap-1.5">
          {locked ? (
            <span className={compactButtonClass}>{label}</span>
          ) : (
            <button className={compactPrimaryButtonClass} type="button" onClick={() => setOpen(true)}>
              {label}
            </button>
          )}
          {printHref && selectedLines.length > 0 ? (
            <Link href={printHref} className={compactButtonClass}>
              Print
            </Link>
          ) : null}
        </div>
        {modal}
      </>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-app-bg/50 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">Tests / scans</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          {printHref && selectedLines.length > 0 ? (
            <Link href={printHref} className={compactButtonClass}>
              Print
            </Link>
          ) : null}
          {locked ? null : (
            <button className={compactPrimaryButtonClass} type="button" onClick={() => setOpen(true)}>
              {draft.length ? "Change" : priorOrderCount > 0 ? "Add more" : "Add"}
            </button>
          )}
        </div>
      </div>
      {selectedLines.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {selectedLines.map((row) => (
            <li
              key={row.key}
              className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-primary ring-1 ring-border"
            >
              {row.label}
            </li>
          ))}
        </ul>
      ) : null}

      {modal}
    </div>
  );
}

function ScanPartGrid({
  title,
  hint,
  test,
  parts,
  labEnabled,
  selected,
  onToggle,
  customPart,
  onCustomPart,
  onAddCustom,
}: {
  title: string;
  hint?: string;
  test: LabTestOption;
  parts: string[];
  labEnabled: boolean;
  selected: InvestigationPick[];
  onToggle: (testId: string, siteLabel: string) => void;
  customPart: string;
  onCustomPart: (value: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <div className="space-y-3 pr-1">
      <div>
        <h4 className="font-semibold text-text-primary">{title}</h4>
        <p className="mt-1 text-sm text-text-secondary">
          {hint ?? "Pick the body part so the centre knows exactly what to do."}
          {labEnabled ? ` · ₹${test.price.toLocaleString("en-IN")} per region` : ""}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {parts.map((part) => {
          const checked = selected.some((pick) => pick.testId === test.id && pick.siteLabel === part);
          return (
            <li key={part}>
              <label
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                  checked ? "border-primary bg-primary-light" : "border-border bg-surface"
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(test.id, part)} className="mt-1" />
                <span className="font-medium text-text-primary">
                  {test.name} · {part}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-sm font-medium text-slate-700">
          Other part (not listed)
          <input
            className={fieldClass}
            value={customPart}
            onChange={(event) => onCustomPart(event.target.value)}
            placeholder="e.g. Left TMJ, contrast study…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddCustom();
              }
            }}
          />
        </label>
        <button className={secondaryButtonClass} type="button" onClick={onAddCustom} disabled={!customPart.trim()}>
          Add part
        </button>
      </div>
    </div>
  );
}
