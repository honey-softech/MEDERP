import { describe, expect, it } from "vitest";
import { formatBrandAuditValue, labelManufacturerIdList, parseStoredManufacturerIds } from "./audit-brand-labels";

describe("medicine brand audit labels", () => {
  it("turns a stored manufacturer id into the brand name", () => {
    const stored = '["m9e6dc1e268640dc2bdf48225613aaebb"]';
    expect(parseStoredManufacturerIds(stored)).toEqual(["m9e6dc1e268640dc2bdf48225613aaebb"]);
    const names = new Map([["m9e6dc1e268640dc2bdf48225613aaebb", "Sun Pharma"]]);
    expect(labelManufacturerIdList(stored, names)).toBe("Sun Pharma");
    expect(labelManufacturerIdList("[]", names)).toBe("None");
  });

  it("lists several brand names in alphabetical order", () => {
    expect(formatBrandAuditValue(["Cipla", "Abbott", "Cipla"])).toBe("Abbott, Cipla");
  });

  it("leaves an already written brand name unchanged", () => {
    expect(labelManufacturerIdList("Abbott", new Map())).toBe("Abbott");
  });
});
