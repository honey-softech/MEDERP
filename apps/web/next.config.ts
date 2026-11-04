import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chrome 111+, Safari 16.4, and Firefox 111 already implement the features in
  // next/dist/build/polyfills/polyfill-module. Shipping them costs ~14 KB on every page.
  turbopack: {
    resolveAlias: {
      "next/dist/build/polyfills/polyfill-module": "./src/lib/empty-module.js",
      "next/dist/build/polyfills/polyfill-module.js": "./src/lib/empty-module.js",
      "../build/polyfills/polyfill-module": "./src/lib/empty-module.js",
      "../build/polyfills/polyfill-module.js": "./src/lib/empty-module.js",
    },
    rules: {
      "*.js": {
        condition: {
          all: ["browser", { path: /[/\\]polyfill-module\.js$/ }],
        },
        loaders: ["./src/lib/strip-polyfill-loader.js"],
        as: "*.js",
      },
    },
  },
  serverExternalPackages: ["@prisma/client", "prisma", "socket.io", "bufferutil", "utf-8-validate"],
  experimental: {
    proxyClientMaxBodySize: "10mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            // Razorpay Checkout loads checkout.js plus risk-detection / assets from cdn.razorpay.com.
            // Blocking those hosts makes “Pay now” look like nothing happened.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com",
              "style-src 'self' 'unsafe-inline' https://*.razorpay.com",
              "img-src 'self' data: blob: https://*.razorpay.com",
              "font-src 'self' data: https://*.razorpay.com",
              "connect-src 'self' ws: wss: https://api.razorpay.com https://lumberjack.razorpay.com https://*.razorpay.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
              "child-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
