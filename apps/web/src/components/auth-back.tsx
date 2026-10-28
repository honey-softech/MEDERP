"use client";

import { useRouter } from "next/navigation";

export function AuthBack({ href = "/" }: { href?: string }) {
  const router = useRouter();

  return (
    <a
      href={href}
      className="auth-back"
      onClick={(event) => {
        event.preventDefault();
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(href);
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </a>
  );
}
