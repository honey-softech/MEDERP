import localFont from "next/font/local";

// Latin-only files. next/font/google also ships latin-ext, and the rupee sign
// (U+20B9) sits in that range, so one ₹ pulled a 34 KB Fraunces file the
// browser could not discover until both stylesheets had downloaded.
export const landingDisplay = localFont({
  src: "./fraunces-latin.woff2",
  variable: "--font-landing-display",
  display: "swap",
  weight: "100 900",
  style: "normal",
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
});

export const landingBody = localFont({
  src: "./source-sans-3-latin.woff2",
  variable: "--font-landing-body",
  display: "swap",
  weight: "200 900",
  style: "normal",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});
