import { NextResponse } from "next/server";
import { z } from "zod";

export function firstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export function invalidBody(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>) {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, response: invalidBody(firstZodError(parsed.error)) };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseUnknown<T>(raw: unknown, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: firstZodError(parsed.error) };
  }
  return { ok: true as const, data: parsed.data };
}
