export function withReturnVisit(path: string, returnVisit: string | null | undefined) {
  if (!returnVisit) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}returnVisit=${encodeURIComponent(returnVisit)}`;
}
