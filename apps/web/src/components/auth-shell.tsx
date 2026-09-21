export {
  buttonClass,
  fieldClass,
  textareaClass,
  compactFieldClass,
  compactTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
  compactButtonClass,
  compactPrimaryButtonClass,
  textActionClass,
  iconButtonClass,
} from "@/lib/ui";

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
  footer,
  headerAction,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-app-bg px-4 py-6 sm:px-6 lg:px-8">
      <div
        className={`flex flex-1 justify-center ${
          wide ? "items-start lg:py-8" : "items-center"
        }`}
      >
        <div
          className={`w-full rounded-lg border border-border bg-surface p-5 shadow-card sm:p-8 ${
            wide ? "max-w-[90rem]" : "max-w-md"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Hospital ERP
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-text-primary">{title}</h1>
              {subtitle ? <p className="mt-1 max-w-3xl text-sm text-text-secondary">{subtitle}</p> : null}
            </div>
            {headerAction}
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
      {footer ? <div className="mt-6 pb-1 text-center">{footer}</div> : null}
    </div>
  );
}
