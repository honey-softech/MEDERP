import { describe, expect, it } from "vitest";
import { isMedErpMobileUserAgent } from "@/lib/drug-catalog-cache/platform";
import { catalogRowInSnapshot, catalogSyncNeedsSnapshot } from "@/lib/drug-catalog-sync";
import {
  catalogTokens,
  drugMatchesForm,
  drugMatchesStrength,
  matchesBrand,
  parseCatalogLine,
  parseDrugQuery,
  rankDrugSuggestions,
  sectionDrugSuggestions,
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

  it("parses strength and dosage form out of a free-text query", () => {
    expect(parseDrugQuery("Paracetamol 500 tablet")).toEqual({
      text: "paracetamol",
      raw: "paracetamol 500 tablet",
      strength: "500mg",
      form: "tablet",
    });
  });

  it("matches pack/name against form and strength filters", () => {
    const dolo = { name: "Dolo 650", salt: "Paracetamol", pack: "15 tablets", manufacturer: "Micro Labs" };
    expect(drugMatchesForm(dolo, "tablet")).toBe(true);
    expect(drugMatchesForm(dolo, "syrup")).toBe(false);
    expect(drugMatchesStrength(dolo, "650mg")).toBe(true);
    expect(drugMatchesStrength(dolo, "500mg")).toBe(false);
  });

  it("ranks name prefixes ahead of other matches, then alphabetically", () => {
    const ranked = rankDrugSuggestions(
      [
        { name: "Calpol 500", manufacturer: null, salt: "Paracetamol" },
        { name: "Paracip", manufacturer: null, salt: "Paracetamol" },
        { name: "Dolo 650", manufacturer: null, salt: "Paracetamol" },
        { name: "Para 500", manufacturer: null, salt: "Paracetamol" },
      ],
      "para",
      [],
      3,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Para 500", "Paracip", "Calpol 500"]);
  });

  it("puts sole Paracetamol compositions before Aceclofenac + Paracetamol combos", () => {
    const ranked = rankDrugSuggestions(
      [
        {
          name: "Hifenac-P",
          manufacturer: "Intas",
          salt: "Aceclofenac + Paracetamol",
          medicineCount: 9000,
        },
        {
          name: "Crocin Advance",
          manufacturer: "GSK",
          salt: "Paracetamol",
          medicineCount: 100,
        },
        {
          name: "Zerodol-P",
          manufacturer: "Ipca",
          salt: "Aceclofenac + Paracetamol",
          medicineCount: 8000,
        },
        {
          name: "Paracetamol 500",
          manufacturer: "Generic",
          salt: "Paracetamol",
          medicineCount: 50,
        },
      ],
      "paracetamol",
      [],
      4,
    );
    expect(ranked.map((row) => row.name)).toEqual([
      "Paracetamol 500",
      "Crocin Advance",
      "Hifenac-P",
      "Zerodol-P",
    ]);
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
    expect(ranked.map((row) => row.name)).toEqual(["Azithro", "Azee", "Azibact"]);
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

  it("sections preferred manufacturers ahead of others", () => {
    const sectioned = sectionDrugSuggestions(
      [
        { name: "Azibact", manufacturer: "Ipca", medicineCount: 8000 },
        { name: "Azee", manufacturer: "Cipla", medicineCount: 200 },
        { name: "Azithro", manufacturer: "Cipla", medicineCount: 100 },
      ],
      "azi",
      ["Cipla"],
      3,
    );
    expect(sectioned.preferred.map((row) => row.name)).toEqual(["Azithro", "Azee"]);
    expect(sectioned.other.map((row) => row.name)).toEqual(["Azibact"]);
  });

  it("prefers exact strength matches when the query includes strength", () => {
    const ranked = rankDrugSuggestions(
      [
        { name: "Dolo 650", manufacturer: "Micro Labs", salt: "Paracetamol", pack: "15 tablets" },
        { name: "Dolo 500", manufacturer: "Micro Labs", salt: "Paracetamol", pack: "15 tablets" },
        { name: "Calpol 500", manufacturer: "GSK", salt: "Paracetamol", pack: "15 tablets" },
      ],
      "paracetamol 500 tablet",
      ["Micro Labs"],
      3,
    );
    expect(ranked[0]?.name).toBe("Dolo 500");
  });

  it("orders preferred manufacturers by admin priority list order", () => {
    const ranked = rankDrugSuggestions(
      [
        { name: "Crocin 500", manufacturer: "Abbott", salt: "Paracetamol", pack: "15 tablets" },
        { name: "Dolo 500", manufacturer: "Micro Labs", salt: "Paracetamol", pack: "15 tablets" },
      ],
      "paracetamol 500",
      ["Micro Labs", "Abbott"],
      2,
    );
    expect(ranked.map((row) => row.name)).toEqual(["Dolo 500", "Crocin 500"]);
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
