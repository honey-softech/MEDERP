import { z } from "zod";
import { STAFF_ROLES, passwordValidationError } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";

const staffRole = z.enum(STAFF_ROLES as unknown as [string, ...string[]], {
  error: "Select a valid hospital role.",
});

function indianMobileFrom(...values: unknown[]) {
  const mobile = normalizeMobile(String(values.find((value) => value != null && String(value).trim()) ?? ""));
  return mobile;
}

export const loginSchema = z
  .object({
    mobile: z.unknown().optional(),
    identifier: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const mobile = indianMobileFrom(data.mobile, data.identifier);
    const password = String(data.password ?? "");
    if (!isValidIndianMobile(mobile) || !password) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid 10-digit mobile number and password.",
      });
      return z.NEVER;
    }
    return { mobile, password };
  });

export const signupSchema = z
  .object({
    username: z.unknown().optional(),
    mobile: z.unknown().optional(),
    password: z.unknown().optional(),
    role: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const username = String(data.username ?? "").trim();
    const mobile = indianMobileFrom(data.mobile);
    const password = String(data.password ?? "");
    const roleRaw = String(data.role ?? "RECEPTIONIST");
    if (username.length < 3) {
      ctx.addIssue({ code: "custom", message: "Username must be at least 3 characters." });
      return z.NEVER;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      ctx.addIssue({
        code: "custom",
        message: "Username can only contain letters, numbers, dots, and underscores.",
      });
      return z.NEVER;
    }
    if (!isValidIndianMobile(mobile)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number." });
      return z.NEVER;
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      ctx.addIssue({ code: "custom", message: passwordError });
      return z.NEVER;
    }
    const roleParsed = staffRole.safeParse(roleRaw);
    if (!roleParsed.success) {
      ctx.addIssue({ code: "custom", message: "Select a valid hospital role." });
      return z.NEVER;
    }
    return { username, mobile, password, role: roleParsed.data as (typeof STAFF_ROLES)[number] };
  });

export const forgotPasswordSchema = z
  .object({
    mobile: z.unknown().optional(),
    identifier: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const mobile = indianMobileFrom(data.mobile, data.identifier);
    if (!isValidIndianMobile(mobile)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the 10-digit mobile number registered on this account.",
      });
      return z.NEVER;
    }
    return { mobile };
  });

export const verifyOtpSchema = z
  .object({
    mobile: z.unknown().optional(),
    otp: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const mobile = indianMobileFrom(data.mobile);
    const otp = String(data.otp ?? "").trim();
    if (!mobile || !otp) {
      ctx.addIssue({ code: "custom", message: "Mobile number and OTP are required." });
      return z.NEVER;
    }
    return { mobile, otp };
  });

export const resetPasswordSchema = z
  .object({
    mobile: z.unknown().optional(),
    otp: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .transform((data, ctx) => {
    const mobile = indianMobileFrom(data.mobile);
    const otp = String(data.otp ?? "").trim();
    const password = String(data.password ?? "");
    if (!mobile || !otp) {
      ctx.addIssue({ code: "custom", message: "Mobile number and OTP are required." });
      return z.NEVER;
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      ctx.addIssue({ code: "custom", message: passwordError });
      return z.NEVER;
    }
    return { mobile, otp, password };
  });
