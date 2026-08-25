"use client";

import { useEffect, useMemo, useState } from "react";
import { primaryButtonClass, secondaryButtonClass, fieldClass } from "@/components/auth-shell";
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
  patientPhone = null,
  priorOrderCount = 0,
}: {
  selectedIds?: string[];
  selectedInvestigations?: InvestigationPick[];
  onChange?: (ids: string[]) => void;
  onInvestigationsChange?: (items: InvestigationPick[]) => void;
  locked?: boolean;
  labEnabled?: boolean;
  patientPhone?: string | null;
  priorOrderCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("blood");
  const [tests, setTests] = useState<LabTestOption[]>([]);
  const [search, setSearch] = useState("");
  const [customPart, setCustomPart] = useState("");
  const initialPicks = selectedInvestigations ?? (selectedIds ?? []).map((testId) => ({ testId }));
  const [draft, setDraft] = useState<InvestigationPick[]>(initialPicks);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [selectedOpen, setSelectedOpen] = useState(true);

  useEffect(() => {
    setDraft(selectedInvestigations ?? (selectedIds ?? []).map((testId) => ({ testId })));
  }, [selectedIds, selectedInvestigations]);

  useEffect(() => {
    void fetch("/api/lab/tests")
      .then((response) => response.json())
      .then((data) => setTests(Array.isArray(data.tests) ? data.tests : []));
  }, []);

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

  const activeModality = SCAN_MODALITIES.find((row) => row.tab === tab);
  const activeScanTest = activeModality ? byCode.get(activeModality.code) : undefined;
  const usgTest = byCode.get("USG");

  return (
    <div className="md:col-span-2 rounded-xl border border-border bg-app-bg/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-text-primary">Investigations</h4>
          <p className="mt-1 text-sm text-text-secondary">
            {labEnabled
              ? "Choose blood tests, X-ray, CT, or MRI. For scans, pick the body part so the request is specific."
              : "Choose blood tests, X-ray, CT, or MRI for the patient to do outside. For scans, pick the body part. WhatsApp/SMS will be added later."}
            {priorOrderCount > 0
              ? ` Earlier requests stay on this visit — you can order more after the first round is done.`
              : ""}
          </p>
          {!labEnabled ? (
            <p className="mt-2 text-xs text-slate-500">
              {patientPhone
                ? `Patient mobile on file: ${patientPhone}. The investigation list will be sent here once messaging is connected.`
                : "No mobile number on the patient file yet. Add one so the list can be sent later."}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedLines.length > 0 ? (
            <ExpandToggle open={selectedOpen} onToggle={() => setSelectedOpen((v) => !v)} count={selectedLines.length} />
          ) : null}
          {locked ? null : (
            <button className={primaryButtonClass} type="button" onClick={() => setOpen(true)}>
              {draft.length
                ? "Change this request"
                : priorOrderCount > 0
                  ? "Order more tests / scans"
                  : "Select tests / scans"}
            </button>
          )}
        </div>
      </div>
      {selectedOpen ? (
        selectedLines.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">No tests or scans selected.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedLines.map((row) => (
              <li
                key={row.key}
                className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-primary ring-1 ring-border"
              >
                {row.label}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-text-primary/40" onClick={() => setOpen(false)}>
          <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
            <div
              className="relative my-4 w-full max-w-4xl rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Select tests and scans</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {draft.length} selected
                    {labEnabled ? "." : ". These will be done outside this hospital."} For X-ray, CT, and MRI, choose the body part.
                  </p>
                </div>
                <button className={secondaryButtonClass} type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-app-bg p-1">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
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

              {tab === "blood" ? (
                <>
                  <input
                    className={fieldClass}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search CBC, thyroid, dengue…"
                  />
                  <div className="mt-4 max-h-[min(28rem,60dvh)] space-y-3 overflow-y-auto pr-1">
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
                <div className="max-h-[min(28rem,60dvh)] space-y-4 overflow-y-auto pr-1">
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

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => setDraft(selectedInvestigations ?? (selectedIds ?? []).map((testId) => ({ testId })))}
                >
                  Reset
                </button>
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={() => {
                    emit(draft);
                    setOpen(false);
                  }}
                >
                  Add selected
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
    <div className="max-h-[min(28rem,60dvh)] space-y-3 overflow-y-auto pr-1">
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
