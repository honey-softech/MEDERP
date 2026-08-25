export {
  buttonClass,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app-bg px-4 py-6 sm:px-6">
      <div
        className={`w-full rounded-lg border border-border bg-surface p-5 shadow-card sm:p-8 ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Hospital ERP
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
