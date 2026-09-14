"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass, textareaClass } from "@/components/auth-shell";
import { HELPDESK_CATEGORIES } from "@/lib/helpdesk-options";

type Reply = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  isActive: boolean;
  useCount: number;
  createdBy: { username: string } | null;
};

export function HelpdeskCannedRepliesManager({ canEditAny }: { canEditAny: boolean }) {
  const router = useRouter();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/helpdesk/canned-replies?all=1");
    const data = await response.json().catch(() => ({}));
    if (response.ok) setReplies(Array.isArray(data.replies) ? data.replies : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/helpdesk/canned-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category: category || null }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create reply.");
      return;
    }
    setTitle("");
    setBody("");
    setCategory("");
    await load();
    router.refresh();
  }

  async function toggleActive(reply: Reply) {
    const response = await fetch(`/api/helpdesk/canned-replies/${reply.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !reply.isActive }),
    });
    if (response.ok) await load();
  }

  async function remove(reply: Reply) {
    if (!window.confirm(`Delete canned reply "${reply.title}"?`)) return;
    const response = await fetch(`/api/helpdesk/canned-replies/${reply.id}`, { method: "DELETE" });
    if (response.ok) await load();
    else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Could not delete.");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">New canned reply</h3>
        <p className="mt-1 text-xs text-slate-500">
          Variables: {"{{ticket_number}}"}, {"{{requester_name}}"}, {"{{agent_name}}"}, {"{{hospital_name}}"}
        </p>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Title
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Category
          <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">General</option>
            {HELPDESK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Body
          <textarea
            className={textareaClass}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <button className={`${buttonClass} mt-3`} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save reply"}
        </button>
      </form>

      <section className="space-y-3">
        {replies.length === 0 ? (
          <p className="text-sm text-slate-500">No canned replies yet.</p>
        ) : (
          replies.map((reply) => (
            <article
              key={reply.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                reply.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900">{reply.title}</h4>
                  <p className="text-xs text-slate-500">
                    {reply.category ?? "General"} · used {reply.useCount}×
                    {reply.createdBy ? ` · by ${reply.createdBy.username}` : ""}
                    {!reply.isActive ? " · inactive" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(canEditAny || true) && (
                    <>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void toggleActive(reply)}
                      >
                        {reply.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void remove(reply)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{reply.body}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
