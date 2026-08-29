"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boardAuthorName, formatBoardTime, prettyRole } from "@/lib/board-display";

type ChatPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string | Date;
  author: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function titleFromMessage(text: string) {
  const first = text.trim().split(/\n/)[0]?.trim() ?? "";
  return first.slice(0, 120);
}

export function BoardChat({
  posts,
  currentUserId,
}: {
  posts: ChatPost[];
  currentUserId: string;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const thread = useMemo(
    () =>
      [...posts].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [posts],
  );

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [thread.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setError("");
    setPending(true);
    const response = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleFromMessage(text), body: text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPending(false);
      setError(data.error ?? "Could not send.");
      return;
    }
    setMessage("");
    setPending(false);
    router.refresh();
  }

  return (
    <section className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">Hospital chat</h3>
        <p className="text-xs text-slate-500">Visible to everyone on staff</p>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
        {thread.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-500">
            No messages yet. Say hello to the rest of the hospital.
          </p>
        ) : (
          thread.map((post) => {
            const mine = post.author.id === currentUserId;
            const name = boardAuthorName(post.author);
            const showTitle = post.title.trim() && post.title.trim() !== post.body.trim();
            return (
              <div key={post.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {mine ? null : (
                  <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">
                    {initials(name)}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                    mine
                      ? "rounded-br-md bg-primary text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {mine ? null : (
                    <p className={`text-[11px] font-medium ${mine ? "text-white/80" : "text-primary"}`}>
                      {name}
                      <span className={mine ? "text-white/60" : "text-slate-400"}> · {prettyRole(post.author.role)}</span>
                    </p>
                  )}
                  {showTitle ? <p className="text-sm font-semibold">{post.title}</p> : null}
                  <p className="whitespace-pre-wrap text-sm leading-snug">{post.body}</p>
                  <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                    {formatBoardTime(post.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="border-t border-slate-200 bg-white p-3">
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-10 max-h-24 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            rows={1}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message the hospital…"
            disabled={pending}
          />
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            type="submit"
            disabled={pending || !message.trim()}
          >
            {pending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
