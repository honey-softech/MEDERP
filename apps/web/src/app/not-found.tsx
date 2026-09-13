import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app-bg px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        This screen is missing, or the record is not in the hospital you are signed into.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Back to home
      </Link>
    </main>
  );
}
