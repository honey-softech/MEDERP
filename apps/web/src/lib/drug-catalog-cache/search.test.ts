import { describe, expect, it } from "vitest";
import { isMedErpMobileUserAgent } from "@/lib/drug-catalog-cache/platform";
import { catalogRowInSnapshot, catalogSyncNeedsSnapshot } from "@/lib/drug-catalog-sync";
import {
  catalogTokens,
  matchesBrand,
  parseCatalogLine,
  rankDrugSuggestions,
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
    const ranked = rankDrugSuggestions(
      [
        { name: "Calpol 500", manufacturer: null },
        { name: "Paracip", manufacturer: null },
        { name: "Dolo 650", manufacturer: null },
        { name: "Para 500", manufacturer: null },
      ],
      "para",
      [],
      3,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Para 500", "Paracip", "Calpol 500"]);
  });

  it("puts admin brands first, then the largest other catalogs, and still shows other brands", () => {
    const ranked = rankDrugSuggestions(
      [
        { name: "Azithral", manufacturer: "Alembic", medicineCount: 20 },
        { name: "Azee", manufacturer: "Cipla", medicineCount: 200 },
        { name: "Azibact", manufacturer: "Ipca", medicineCount: 8000 },
        { name: "Azithro", manufacturer: "Cipla", medicineCount: 100 },
      ],
      "azi",
      ["Cipla"],
      3,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Azee", "Azithro", "Azibact"]);
  });

  it("fills the list from other brands when the selected manufacturer has no match", () => {
    const ranked = rankDrugSuggestions(
      [
        { name: "Dolokind", manufacturer: "Mankind", medicineCount: 50 },
        { name: "Dolopar", manufacturer: "Micro Labs", medicineCount: 400 },
        { name: "Dolo 650", manufacturer: "Micro Labs", medicineCount: 400 },
      ],
      "dol",
      ["Cipla"],
      2,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Dolo 650", "Dolopar"]);
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