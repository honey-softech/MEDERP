import Image from "next/image";
import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AuthBack } from "@/components/auth-back";

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

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-landing-body",
});

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
  footer,
  headerAction,
  /** Kept so existing pages compile. The shell now matches the homepage, without doodles. */
  doodles: _doodles = false,
  /** Sign-in stays put while the mobile keyboard opens. */
  keyboardSafe = false,
  kicker = "MedERP",
  backHref = "/",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  doodles?: boolean;
  keyboardSafe?: boolean;
  kicker?: string;
  /** Used when this screen was opened directly and there is no previous page. */
  backHref?: string;
}) {
  void _doodles;

  return (
    <div className={`auth-stage ${display.variable} ${body.variable}${keyboardSafe ? " auth-signin" : ""}`}>
      <header className="auth-top">
        <div className={`mx-auto flex w-full items-center justify-between gap-3 px-5 py-3.5 sm:px-8 ${wide ? "max-w-[90rem]" : "max-w-6xl"}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <AuthBack href={backHref} />
            <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
            <Image
              src="/mederp-icon.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <span className="auth-brand text-xl font-semibold tracking-tight text-[#10211e] sm:text-2xl">MedERP</span>
            </Link>
          </div>
          {headerAction}
        </div>
      </header>

      <div className={`mx-auto w-full px-4 pb-8 sm:px-8 ${wide ? "max-w-[90rem]" : "max-w-6xl"}`}>
        <div className={`auth-split ${wide ? "auth-split-wide" : ""}`}>
          <aside className="auth-aside">
            <div className="min-w-0">
              <p className="auth-kicker">{kicker}</p>
              <h1 className="auth-title">{title}</h1>
            </div>
            {subtitle ? <p className="auth-lead">{subtitle}</p> : null}
          </aside>
          <div className="auth-card">{children}</div>
        </div>
        {footer ? <div className="auth-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
