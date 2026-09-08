"use client";

import { useEffect, useState } from "react";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";
import { SignatureCapture } from "@/components/signature-capture";
import { statusBadge, statusBadgeBase } from "@/lib/ui";
import { suggestedSignatureName } from "@/lib/usernames";

type ActiveSignature = {
  id: string;
  version: number;
  displayName: string;
  credentials: string | null;
  imageData: string;
  uploadedByUsername: string;
  createdAt: string;
};

type HistoryRow = {
  id: string;
  status: string;
  version: number;
  displayName: string;
  uploadedByUsername: string;
  createdAt: string;
  revokedAt: string | null;
};

export function UserSignatureManager({
  userId,
  roleLabel,
  firstName = "",
  lastName = "",
  role = "",
  embedded = false,
}: {
  userId: string;
  roleLabel: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveSignature | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [credentials, setCredentials] = useState("");
  const [captured, setCaptured] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const url = `/api/hospital/users/${userId}/signature`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(url);
      const data = await response.json().catch(() => null);
      if (cancelled) return;
      setLoading(false);
      if (!response.ok) {
        setError(data?.error ?? "Could not load the signature.");
        return;
      }
      setActive(data.active ?? null);
      setHistory(data.history ?? []);
      const fromNames = suggestedSignatureName(firstName, lastName, role);
      setDisplayName(fromNames || data.active?.displayName || data.suggestedName || "");
      setNameTouched(false);
      setCredentials(data.active?.credentials ?? data.suggestedCredentials ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (nameTouched) return;
    const fromNames = suggestedSignatureName(firstName, lastName, role);
    if (fromNames) setDisplayName(fromNames);
  }, [firstName, lastName, role, nameTouched]);

  async function save() {
    setError("");
    setSaved("");
    setPending(true);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData: captured, displayName, credentials }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save the signature.");
      return;
    }
    if (active) {
      setHistory((rows) => [
        {
          id: active.id,
          status: "REVOKED",
          version: active.version,
          displayName: active.displayName,
          uploadedByUsername: active.uploadedByUsername,
          createdAt: active.createdAt,
          revokedAt: new Date().toISOString(),
        },
        ...rows,
      ]);
    }
    setActive({
      id: data.signature.id,
      version: data.signature.version,
      displayName: data.signature.displayName,
      credentials: data.signature.credentials,
      imageData: captured,
      uploadedByUsername: "you",
      createdAt: data.signature.createdAt,
    });
    setCaptured("");
    setSaved(`Signature v${data.signature.version} is now active and will appear on documents this user signs.`);
  }

  async function revoke() {
    setError("");
    setSaved("");
    setPending(true);
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not revoke the signature.");
      return;
    }
    if (active) {
      setHistory((rows) => [
        {
          id: active.id,
          status: "REVOKED",
          version: active.version,
          displayName: active.displayName,
          uploadedByUsername: active.uploadedByUsername,
          createdAt: active.createdAt,
          revokedAt: new Date().toISOString(),
        },
        ...rows,
      ]);
    }
    setActive(null);
    setSaved("Signature revoked. Documents already signed keep the signature they were signed with.");
  }

  const collapsedHint = loading
    ? "Checking…"
    : active
      ? `On file · v${active.version}. Expand to replace.`
      : "No signature on file. Expand to add.";

  return (
    <section
      className={
        embedded
          ? "rounded-xl border border-slate-200"
          : "max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm"
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h3 className="font-semibold">Signature and seal</h3>
          {!open ? <p className="text-xs text-slate-500">{collapsedHint}</p> : null}
        </div>
        <ExpandToggle open={open} onToggle={() => setOpen((current) => !current)} />
      </div>

      {open ? (
        <div className="grid gap-4 border-t border-slate-200 p-3 sm:p-4">
          <p className="text-sm text-slate-500">
            Ask the {roleLabel.toLowerCase()} to sign and stamp a blank white sheet, then scan or photograph it here.
            Once saved, it prints on documents this user signs off. Only a hospital admin can add or replace it.
          </p>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-28 w-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                  {active ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.imageData} alt="Signature on file" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-sm text-slate-400">No signature on file</span>
                  )}
                </div>
                <div className="text-sm">
                  <span className={`${statusBadgeBase} ${active ? statusBadge.success : statusBadge.neutral}`}>
                    {active ? `Active · v${active.version}` : "Not on file"}
                  </span>
                  {active ? (
                    <p className="mt-2 text-slate-500">
                      Uploaded by {active.uploadedByUsername} on{" "}
                      {new Date(active.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Name printed under the signature
                  <input
                    className={fieldClass}
                    value={displayName}
                    onChange={(event) => {
                      setNameTouched(true);
                      setDisplayName(event.target.value);
                    }}
                    placeholder="Dr. A. Kumar"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Qualifications / registration
                  <input
                    className={fieldClass}
                    value={credentials}
                    onChange={(event) => setCredentials(event.target.value)}
                    placeholder="MBBS, MD, Reg. 12345"
                  />
                </label>
              </div>

              {capturing ? (
                <SignatureCapture
                  onCancel={() => setCapturing(false)}
                  onCapture={(dataUrl) => {
                    setCaptured(dataUrl);
                    setCapturing(false);
                  }}
                />
              ) : captured ? (
                <div className="grid gap-3">
                  <p className="text-sm font-medium text-slate-700">Ready to save</p>
                  <div className="flex h-28 w-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={captured} alt="New signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={primaryButtonClass} disabled={pending} onClick={() => void save()}>
                      {pending ? "Saving…" : active ? "Replace signature" : "Save signature"}
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => setCaptured("")}>
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondaryButtonClass} onClick={() => setCapturing(true)}>
                    {active ? "Replace signature" : "Upload signature"}
                  </button>
                  {active ? (
                    <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => void revoke()}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {saved ? <p className="text-sm text-teal-700">{saved}</p> : null}

              {history.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700">
                    Earlier versions ({history.length})
                  </summary>
                  <ul className="mt-2 grid gap-1 text-slate-500">
                    {history.map((row) => (
                      <li key={row.id}>
                        v{row.version} · {row.displayName} · uploaded by {row.uploadedByUsername} on{" "}
                        {new Date(row.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        {row.revokedAt
                          ? ` · revoked ${new Date(row.revokedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-400">
                    Earlier versions are kept so documents signed with them keep reprinting correctly.
                  </p>
                </details>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
