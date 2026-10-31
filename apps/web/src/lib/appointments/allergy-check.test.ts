import { describe, expect, it } from "vitest";
import { checkAllergy } from "@/lib/appointments/allergy-check";

describe("checkAllergy", () => {
  it("matches a penicillin allergy to an amoxicillin salt", () => {
    expect(
      checkAllergy("Penicillin", { name: "Moxikind-CV", salt: "Amoxicillin + Clavulanic Acid" }),
    ).toMatchObject({ id: "penicillins" });
  });

  it("matches amoxicillin written as the allergy itself", () => {
    expect(checkAllergy("amoxicillin", { name: "Amoxyclav 625", salt: "Amoxicillin" })).toMatchObject({
      id: "penicillins",
    });
  });

  it("does not cross-warn a penicillin allergy onto a cephalosporin", () => {
    expect(checkAllergy("penicillin", { name: "Cefixime", salt: "Cefixime" })).toBeNull();
  });

  it("stays silent when no allergy is recorded", () => {
    expect(checkAllergy("", { name: "Amoxicillin", salt: "Amoxicillin" })).toBeNull();
    expect(checkAllergy("   ", { name: "Amoxicillin", salt: "Amoxicillin" })).toBeNull();
    expect(checkAllergy(null, { name: "Amoxicillin", salt: "Amoxicillin" })).toBeNull();
  });

  it("stays silent for negative-only allergy notes", () => {
    expect(checkAllergy("NKDA", { name: "Amoxicillin", salt: "Amoxicillin" })).toBeNull();
    expect(checkAllergy("no known allergies", { name: "Ciprofloxacin", salt: "Ciprofloxacin" })).toBeNull();
    expect(checkAllergy("nil", { name: "Ibuprofen", salt: "Ibuprofen" })).toBeNull();
  });

  it("does not treat sulphate salts as sulfa drugs", () => {
    expect(checkAllergy("sulfa", { name: "Fesovit", salt: "Ferrous Sulphate" })).toBeNull();
  });

  it("matches cotrimoxazole salts to a sulfa allergy", () => {
    expect(
      checkAllergy("sulpha", { name: "Bactrim", salt: "Sulfamethoxazole + Trimethoprim" }),
    ).toMatchObject({ id: "sulfonamides" });
  });

  it("does not treat paracetamol as an NSAID", () => {
    expect(checkAllergy("ibuprofen", { name: "Dolo 650", salt: "Paracetamol" })).toBeNull();
  });

  it("matches another NSAID in the same class", () => {
    expect(checkAllergy("Brufen", { name: "Voveran", salt: "Diclofenac Sodium" })).toMatchObject({
      id: "nsaids",
    });
  });

  it("stays silent for unrelated allergies", () => {
    expect(checkAllergy("dust mite", { name: "Azithral", salt: "Azithromycin" })).toBeNull();
  });

  it("does not match nystatin to a statin allergy", () => {
    expect(checkAllergy("statin", { name: "Nystatin", salt: "Nystatin" })).toBeNull();
  });

  it("matches a named statin", () => {
    expect(checkAllergy("statin", { name: "Atorva", salt: "Atorvastatin" })).toMatchObject({ id: "statins" });
  });

  it("does not match a macrolide allergy to gentamicin", () => {
    expect(checkAllergy("azithromycin", { name: "Genticyn", salt: "Gentamicin" })).toBeNull();
  });

  it("matches the same macrolide", () => {
    expect(checkAllergy("azithromycin", { name: "Azithral", salt: "Azithromycin" })).toMatchObject({
      id: "macrolides",
    });
  });

  it("matches a cipro shorthand to ciprofloxacin", () => {
    expect(checkAllergy("cipro", { name: "Ciplox", salt: "Ciprofloxacin" })).toMatchObject({
      id: "fluoroquinolones",
    });
  });
});
