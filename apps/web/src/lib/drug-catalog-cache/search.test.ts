import { describe, expect, it } from "vitest";
import { isMedErpMobileUserAgent } from "@/lib/drug-catalog-cache/platform";
import { catalogRowInSnapshot, catalogSyncNeedsSnapshot } from "@/lib/drug-catalog-sync";
import {
  catalogTokens,
  matchesBrand,
  parseCatalogLine,
  rankCatalogMatches,
  toCachedDrug,
} from "@/lib/drug-catalog-cache/search";

describe("drug catalog local search", () => {
  it("tokenizes name, salt, and manufacturer and drops tiny fragments", () => {
    expect(catalogTokens("Dolo 650 Paracetamol Micro Labs")).toEqual([
      "dolo",
      "650",
      "paracetamol",
      "micro",
      "labs",
    ]);
  });

  it("ranks name prefixes ahead of other matches, then alphabetically", () => {
    const ranked = rankCatalogMatches(
      [
        { name: "Calpol 500" },
        { name: "Paracip" },
        { name: "Dolo 650" },
        { name: "Para 500" },
      ],
      "para",
      3,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Para 500", "Paracip", "Calpol 500"]);
  });

  it("builds a cache record from a snapshot line", () => {
    const row = parseCatalogLine(
      JSON.stringify({
        id: "c1",
        name: "Dolo 650",
        salt: "Paracetamol",
        pack: "15 tablets",
        manufacturer: "Micro Labs",
        searchText: "dolo 650 paracetamol micro labs",
      }),
    );
    expect(row?.id).toBe("c1");
    expect(toCachedDrug(row!).tokens).toContain("paracetamol");
    expect(toCachedDrug(row!).nameLower).toBe("dolo 650");
  });

  it("rejects a catalog line that is not a medicine row", () => {
    expect(parseCatalogLine("")).toBeNull();
    expect(parseCatalogLine("   ")).toBeNull();
    expect(() => parseCatalogLine('{"nope":true}')).toThrow(/Invalid catalog row/);
  });

  it("applies the hospital brand filter only when brands are selected", () => {
    const brands = new Set(["micro labs"]);
    expect(matchesBrand("Micro Labs", null)).toBe(true);
    expect(matchesBrand("Micro Labs", brands)).toBe(true);
    expect(matchesBrand("Cipla", brands)).toBe(false);
    expect(matchesBrand(null, brands)).toBe(false);
  });

  it("asks for a fresh snapshot when the delta is large", () => {
    expect(catalogSyncNeedsSnapshot(5000)).toBe(false);
    expect(catalogSyncNeedsSnapshot(5001)).toBe(true);
  });

  it("treats only the phone app user agent as the on-device catalog client", () => {
    expect(isMedErpMobileUserAgent("Mozilla/5.0 MedERPMobile")).toBe(true);
    expect(isMedErpMobileUserAgent("Mozilla/5.0 Chrome/120.0.0.0")).toBe(false);
  });

  it("hides unpublished rows and rows newer than the snapshot cursor", () => {
    expect(catalogRowInSnapshot(0, 4)).toBe(false);
    expect(catalogRowInSnapshot(4, 4)).toBe(true);
    expect(catalogRowInSnapshot(5, 4)).toBe(false);
  });
});