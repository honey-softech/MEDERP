export type PatientActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number };
