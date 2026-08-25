export function slugFromHospitalName(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  let slug =
    words.length === 1
      ? words[0].slice(0, 8)
      : `${words[0].slice(0, 4)}${words.slice(1).map((word) => word.slice(0, 2)).join("")}`.slice(0, 10);
  if (slug.length < 3) slug = `${slug}HSP`.slice(0, 8);
  return slug.replace(/[^A-Z0-9-]/g, "");
}

export function isValidHospitalCode(code: string) {
  return /^[A-Z0-9-]{3,12}$/.test(code.trim().toUpperCase());
}
