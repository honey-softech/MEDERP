import { headers } from "next/headers";

/** Prefer the dynamic segment; fall back to x-pathname if Next omits params. */
export async function routeParam(
  params: Promise<Record<string, string | undefined>>,
  key: string,
) {
  const resolved = await params;
  const fromParams = resolved[key]?.trim();
  if (fromParams) return fromParams;
  const path = (await headers()).get("x-pathname") ?? "";
  return path.split("/").filter(Boolean).pop() ?? "";
}
