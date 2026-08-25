"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";

export function HelpdeskAgentForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/platform/helpdesk-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, mobile, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not create helpdesk user.");
      return;
    }
    setUsername("");
    setMobile("");
    setPassword("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Add helpdesk agent</h3>
      <label className="block text-sm font-medium text-slate-700">
        Username
        <input className={fieldClass} value={username} onChange={(event) => setUsername(event.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Mobile
        <input className={fieldClass} inputMode="numeric" value={mobile} onChange={(event) => setMobile(event.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create helpdesk user"}
      </button>
    </form>
  );
}
