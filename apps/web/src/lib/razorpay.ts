import crypto from "crypto";
import Razorpay from "razorpay";

export function razorpayConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !secret) return false;
  if (keyId.includes("xxxxxxxx") || secret.includes("xxxxxxxx")) return false;
  return true;
}

export function razorpayKeyId() {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || process.env.RAZORPAY_KEY_ID?.trim() || "";
}

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.");
  }
  return new Razorpay({ key_id, key_secret });
}

/** Convert rupees to paise for Razorpay amounts. */
export function toPaise(amountInr: number) {
  return Math.round(Number(amountInr) * 100);
}

export function fromPaise(amountPaise: number) {
  return Number(amountPaise) / 100;
}

/** One-time order checkout signature: order_id|payment_id */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}

/** Subscription checkout signature: payment_id|subscription_id */
export function verifyRazorpaySubscriptionSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const payload = `${params.paymentId}|${params.subscriptionId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function isRazorpaySubscriptionsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const nested = "error" in error ? (error as { error?: unknown }).error : undefined;

  // Generic auth/expired keys must NOT be treated as "subscriptions disabled".
  if (nested && typeof nested === "object") {
    const description = String((nested as { description?: string }).description ?? "").toLowerCase();
    if (
      description.includes("authentication failed") ||
      description.includes("expired") ||
      description.includes("api key provided")
    ) {
      return false;
    }
    if (description.includes("subscription") && (description.includes("not enabled") || description.includes("not activated"))) {
      return true;
    }
  }

  // Razorpay often returns a bare "Unauthorized" string for /v1/plans when Subscriptions is off,
  // while Orders still work with the same keys.
  if (typeof nested === "string" && nested.toLowerCase() === "unauthorized") {
    return true;
  }

  return false;
}

export function razorpayErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const statusCode = "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : undefined;
    const nested = "error" in error ? (error as { error?: unknown }).error : undefined;
    if (nested && typeof nested === "object") {
      const description = String(
        (nested as { description?: string }).description
          || (nested as { reason?: string }).reason
          || (nested as { code?: string }).code
          || "",
      ).trim();
      if (description) {
        const lower = description.toLowerCase();
        if (lower.includes("expired") || lower.includes("authentication failed")) {
          return "Razorpay API keys are invalid or expired. Regenerate Test Mode keys in the Razorpay Dashboard, update RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID in apps/web/.env, then restart npm run dev.";
        }
        return description;
      }
    }
    if (typeof nested === "string" && nested.trim()) {
      if (nested.toLowerCase() === "unauthorized") {
        return "Razorpay Subscriptions is not enabled for these API keys (or keys are unauthorized).";
      }
      return nested;
    }
    if (statusCode === 401) {
      return "Razorpay authentication failed. Regenerate Test Mode API keys and update apps/web/.env, then restart the server.";
    }
  }
  if (error instanceof Error) return error.message;
  return "";
}
