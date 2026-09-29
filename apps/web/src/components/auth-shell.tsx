import Image from "next/image";
import Link from "next/link";

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
  /** Soft landing-page wash + light doodles (login / register / demo). */
  doodles = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  doodles?: boolean;
}) {
  const shell = (
    <div className={`flex min-h-dvh flex-col px-4 py-6 sm:px-6 lg:px-8 ${doodles ? "" : "bg-app-bg"}`}>
      <div
        className={`flex flex-1 justify-center ${
          wide ? "items-start lg:py-8" : "items-center"
        }`}
      >
        <div
          className={`auth-card w-full rounded-xl border border-border bg-surface p-5 shadow-card sm:p-8 ${
            wide ? "max-w-[90rem]" : "max-w-md"
          }`}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/mederp-icon.png"
                alt="MedERP"
                width={36}
                height={36}
                className="h-9 w-9 rounded-md"
                priority
              />
              <span className="text-lg font-semibold tracking-tight text-[#0c2f2c]">MedERP</span>
            </Link>
            {headerAction}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#0c1f2e]">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-3xl text-sm text-[#3d5668]">{subtitle}</p> : null}
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
      {footer ? <div className="mt-4 pb-2 text-center">{footer}</div> : null}
    </div>
  );

  if (!doodles) return shell;

  return (
    <div className="auth-doodle-page">
      <div className="auth-doodle-layer" aria-hidden>
        <AuthDoodles sparse={wide} />
      </div>
      {shell}
    </div>
  );
}

/** Fewer doodles on wide forms so the page does not feel busy or washed out. */
function AuthDoodles({ sparse = false }: { sparse?: boolean }) {
  return (
    <>
      <svg className="landing-doodle-pulse absolute left-[5%] top-[14%] h-10 w-16 text-[#1a5c5c]/30 sm:left-[8%] sm:h-12 sm:w-20" viewBox="0 0 120 40" fill="none">
        <path
          d="M2 22h18l6-14 10 28 8-18 6 8h52"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="landing-doodle-float absolute right-[7%] top-[12%] h-10 w-10 text-[#c45c4a]/35 sm:right-[10%] sm:h-12 sm:w-12" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 42s-14-9.2-14-20a8 8 0 0 1 14-5.2A8 8 0 0 1 38 22c0 10.8-14 20-14 20Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M24 16v12M18 22h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {!sparse ? (
        <svg className="landing-doodle-float-slow absolute bottom-[16%] left-[6%] h-14 w-10 text-[#1a5c5c]/28 sm:left-[9%] sm:h-16 sm:w-12" viewBox="0 0 40 56" fill="none">
          <rect x="4" y="2" width="32" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="8" y="8" width="24" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="20" cy="48" r="1.8" fill="currentColor" />
        </svg>
      ) : null}
      <svg className="landing-doodle-float absolute right-[6%] bottom-[18%] h-12 w-12 text-[#1a5c5c]/28 sm:right-[8%] sm:h-14 sm:w-14" viewBox="0 0 56 56" fill="none">
        <path d="M16 8v10a12 12 0 0 0 24 0V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 8c0-2 2-4 4-4h2M40 8c0-2-2-4-4-4h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 30v8a8 8 0 1 0 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="38" r="5" stroke="currentColor" strokeWidth="2" />
      </svg>
      {!sparse ? (
        <svg className="landing-doodle-float-slow absolute left-[14%] top-[44%] hidden h-10 w-10 text-[#1a5c5c]/22 md:block" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M6 18h36M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : null}
      <svg className="landing-doodle-float-slow absolute bottom-[10%] right-[20%] h-12 w-7 text-[#1a5c5c]/24" viewBox="0 0 28 56" fill="none">
        <rect x="10" y="4" width="8" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="42" r="8" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="42" r="3.5" fill="currentColor" />
      </svg>
      <svg className="absolute left-[30%] top-[16%] h-7 w-12 text-[#1a5c5c]/18" viewBox="0 0 80 40" fill="none">
        <path d="M12 20l2.2-6 2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2Z" fill="currentColor" />
        <path d="M48 12l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="currentColor" />
      </svg>
    </>
  );
}
