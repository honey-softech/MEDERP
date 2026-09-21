/** Shared Razorpay Checkout.js types and loader. */

export type RazorpayOrderSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpaySubscriptionSuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutSuccess = RazorpayOrderSuccess | RazorpaySubscriptionSuccess;

export type RazorpayCheckoutOptions = {
  key: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  /** Subscriptions need a card mandate. Hide UPI/netbanking so Test Mode does not fail on those. */
  config?: {
    display?: {
      hide?: { method: string }[];
      preferences?: { show_default_blocks?: boolean };
    };
  };
  handler: (response: RazorpayCheckoutSuccess) => void;
  modal?: { ondismiss?: () => void };
};

export type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: {
      error?: { description?: string; reason?: string; code?: string };
    }) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export const RAZORPAY_SUBSCRIPTION_CHECKOUT_CONFIG: RazorpayCheckoutOptions["config"] = {
  display: {
    hide: [{ method: "upi" }, { method: "netbanking" }, { method: "wallet" }, { method: "emi" }, { method: "paylater" }],
    preferences: { show_default_blocks: true },
  },
};

export function razorpayFailureMessage(response: {
  error?: { description?: string; reason?: string; code?: string };
}) {
  const err = response?.error;
  return (
    [err?.description, err?.reason].filter(Boolean).join(" — ") ||
    err?.code ||
    "Razorpay could not complete this payment."
  );
}

export function attachRazorpayFailureHandler(
  checkout: RazorpayCheckoutInstance,
  onFailed: (message: string) => void,
) {
  checkout.on("payment.failed", (response) => {
    onFailed(razorpayFailureMessage(response));
  });
}

export function loadRazorpayCheckoutScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function isOrderCheckoutSuccess(response: RazorpayCheckoutSuccess): response is RazorpayOrderSuccess {
  return "razorpay_order_id" in response && Boolean(response.razorpay_order_id);
}
