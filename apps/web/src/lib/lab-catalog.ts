export type LabCatalogEntry = {
  code: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  kind?: "BLOOD" | "SCAN";
};

export type ScanTabId = "xray" | "ct" | "mri";

export type ScanModality = {
  tab: ScanTabId;
  code: string;
  name: string;
  category: string;
  price: number;
  parts: string[];
};

export const SCAN_MODALITIES: ScanModality[] = [
  {
    tab: "xray",
    code: "XRAY",
    name: "X-ray",
    category: "X-ray",
    price: 400,
    parts: [
      "Chest PA",
      "Chest AP",
      "Cervical spine",
      "Dorsal spine",
      "Lumbar spine / LS",
      "KUB",
      "Shoulder (left)",
      "Shoulder (right)",
      "Elbow (left)",
      "Elbow (right)",
      "Wrist / hand (left)",
      "Wrist / hand (right)",
      "Pelvis",
      "Hip (left)",
      "Hip (right)",
      "Knee (left)",
      "Knee (right)",
      "Ankle / foot (left)",
      "Ankle / foot (right)",
    ],
  },
  {
    tab: "ct",
    code: "CT",
    name: "CT",
    category: "CT",
    price: 3500,
    parts: [
      "Brain",
      "PNS",
      "Neck",
      "Chest",
      "Abdomen",
      "KUB",
      "Cervical spine",
      "Lumbar spine",
      "Whole spine",
      "Angiography",
    ],
  },
  {
    tab: "mri",
    code: "MRI",
    name: "MRI",
    category: "MRI",
    price: 5500,
    parts: [
      "Brain",
      "Pituitary",
      "Cervical spine",
      "Dorsal spine",
      "Lumbar spine",
      "Whole spine",
      "Shoulder (left)",
      "Shoulder (right)",
      "Elbow (left)",
      "Elbow (right)",
      "Wrist (left)",
      "Wrist (right)",
      "Hip (left)",
      "Hip (right)",
      "Knee (left)",
      "Knee (right)",
      "Ankle (left)",
      "Ankle (right)",
      "Pelvis / SI joints",
      "Abdomen",
      "Screening",
    ],
  },
];

export const LAB_CATEGORIES = [
  "Hematology",
  "Biochemistry — Diabetes",
  "Liver Function",
  "Kidney Function",
  "Lipid Profile",
  "Thyroid",
  "Cardiac",
  "Infection / Fever Panel",
  "Viral Markers",
  "Vitamins & Minerals",
  "Hormonal / Reproductive",
  "Cancer Markers",
  "Allergy & Immunology",
] as const;

export const LAB_CATALOG: LabCatalogEntry[] = [
  { code: "CBC", name: "Complete Blood Count (CBC)", category: "Hematology", description: "Hb, TLC, DLC, platelets, RBC indices", price: 450 },
  { code: "ESR", name: "ESR (Erythrocyte Sedimentation Rate)", category: "Hematology", price: 150 },
  { code: "PBS", name: "Peripheral Blood Smear", category: "Hematology", price: 200 },
  { code: "RETIC", name: "Reticulocyte Count", category: "Hematology", price: 250 },
  { code: "COAG", name: "Coagulation profile (PT/INR, aPTT, BT, CT)", category: "Hematology", price: 650 },
  { code: "DDIMER", name: "D-Dimer", category: "Hematology", price: 900 },
  { code: "FBS", name: "Fasting Blood Sugar (FBS)", category: "Biochemistry — Diabetes", price: 80 },
  { code: "PPBS", name: "Postprandial Blood Sugar (PPBS)", category: "Biochemistry — Diabetes", price: 80 },
  { code: "RBS", name: "Random Blood Sugar (RBS)", category: "Biochemistry — Diabetes", price: 80 },
  { code: "HBA1C", name: "HbA1c (glycated hemoglobin)", category: "Biochemistry — Diabetes", price: 450 },
  { code: "OGTT", name: "Oral Glucose Tolerance Test (OGTT)", category: "Biochemistry — Diabetes", price: 350 },
  { code: "INSULIN", name: "Insulin (fasting)", category: "Biochemistry — Diabetes", price: 700 },
  { code: "LFT", name: "LFT panel", category: "Liver Function", description: "Bilirubin, SGOT/AST, SGPT/ALT, ALP, GGT, protein, albumin, globulin, A/G", price: 700 },
  { code: "KFT", name: "KFT/RFT panel", category: "Kidney Function", description: "Urea, creatinine, uric acid, electrolytes, eGFR", price: 700 },
  { code: "BUN", name: "BUN (Blood Urea Nitrogen)", category: "Kidney Function", price: 150 },
  { code: "LIPID", name: "Lipid Profile", category: "Lipid Profile", description: "Total cholesterol, HDL, LDL, VLDL, triglycerides", price: 550 },
  { code: "TFT", name: "Thyroid profile (T3, T4, TSH)", category: "Thyroid", price: 600 },
  { code: "FT3FT4", name: "Free T3, Free T4", category: "Thyroid", price: 550 },
  { code: "ANTITPO", name: "Anti-TPO", category: "Thyroid", price: 800 },
  { code: "TROP", name: "Troponin I/T", category: "Cardiac", price: 1200 },
  { code: "CKMB", name: "CK-MB", category: "Cardiac", price: 600 },
  { code: "CPK", name: "CPK (Creatine Phosphokinase)", category: "Cardiac", price: 400 },
  { code: "BNP", name: "BNP/NT-proBNP", category: "Cardiac", price: 1800 },
  { code: "HCY", name: "Homocysteine", category: "Cardiac", price: 900 },
  { code: "WIDAL", name: "Widal Test (typhoid)", category: "Infection / Fever Panel", price: 200 },
  { code: "DENGUE", name: "Dengue NS1, IgM, IgG", category: "Infection / Fever Panel", price: 900 },
  { code: "MALARIA", name: "Malaria antigen/smear", category: "Infection / Fever Panel", price: 250 },
  { code: "CRP", name: "CRP (C-Reactive Protein)", category: "Infection / Fever Panel", price: 400 },
  { code: "PCT", name: "Procalcitonin", category: "Infection / Fever Panel", price: 1500 },
  { code: "BCULT", name: "Blood Culture & Sensitivity", category: "Infection / Fever Panel", price: 900 },
  { code: "HIV", name: "HIV (I & II)", category: "Viral Markers", price: 450 },
  { code: "HBSAG", name: "HBsAg (Hepatitis B)", category: "Viral Markers", price: 350 },
  { code: "AHCV", name: "Anti-HCV (Hepatitis C)", category: "Viral Markers", price: 500 },
  { code: "VDRL", name: "VDRL (Syphilis)", category: "Viral Markers", price: 200 },
  { code: "VITD", name: "Vitamin D (25-OH)", category: "Vitamins & Minerals", price: 1200 },
  { code: "B12", name: "Vitamin B12", category: "Vitamins & Minerals", price: 800 },
  { code: "FOLATE", name: "Folic Acid", category: "Vitamins & Minerals", price: 700 },
  { code: "IRON", name: "Iron Studies", category: "Vitamins & Minerals", description: "Serum iron, TIBC, ferritin, transferrin saturation", price: 900 },
  { code: "CAPMG", name: "Calcium, Phosphorus, Magnesium", category: "Vitamins & Minerals", price: 350 },
  { code: "LHFSHPRL", name: "LH, FSH, Prolactin", category: "Hormonal / Reproductive", price: 1200 },
  { code: "TESTO", name: "Testosterone", category: "Hormonal / Reproductive", price: 700 },
  { code: "E2", name: "Estradiol", category: "Hormonal / Reproductive", price: 700 },
  { code: "BHCG", name: "Beta hCG", category: "Hormonal / Reproductive", price: 500 },
  { code: "PROG", name: "Progesterone", category: "Hormonal / Reproductive", price: 600 },
  { code: "AMH", name: "AMH (Anti-Müllerian Hormone)", category: "Hormonal / Reproductive", price: 1800 },
  { code: "PSA", name: "PSA (Prostate)", category: "Cancer Markers", price: 700 },
  { code: "CA125", name: "CA 125 (Ovarian)", category: "Cancer Markers", price: 900 },
  { code: "CA199", name: "CA 19-9 (Pancreatic)", category: "Cancer Markers", price: 900 },
  { code: "CEA", name: "CEA", category: "Cancer Markers", price: 800 },
  { code: "AFP", name: "AFP (Alpha-fetoprotein)", category: "Cancer Markers", price: 800 },
  { code: "IGE", name: "Total IgE", category: "Allergy & Immunology", price: 600 },
  { code: "ANA", name: "ANA (Antinuclear Antibody)", category: "Allergy & Immunology", price: 800 },
  { code: "RA", name: "RA Factor", category: "Allergy & Immunology", price: 400 },
  { code: "ASO", name: "ASO Titer", category: "Allergy & Immunology", price: 350 },
];

export const SCAN_CATALOG: LabCatalogEntry[] = [
  ...SCAN_MODALITIES.map((modality) => ({
    code: modality.code,
    name: modality.name,
    category: modality.category,
    kind: "SCAN" as const,
    price: modality.price,
    description: `Specify the body part on the ${modality.name} tab`,
  })),
  { code: "USG", name: "Ultrasound", category: "Other scans", kind: "SCAN", price: 900, description: "Specify the area in the part field" },
  { code: "ECG", name: "ECG", category: "Other scans", kind: "SCAN", price: 250 },
  { code: "ECHO", name: "2D Echo", category: "Other scans", kind: "SCAN", price: 1800 },
];

export const ALL_LAB_CATALOG: LabCatalogEntry[] = [...LAB_CATALOG, ...SCAN_CATALOG];

export type InvestigationPick = {
  testId: string;
  siteLabel?: string | null;
};

export function investigationLineName(testName: string, siteLabel?: string | null) {
  const site = String(siteLabel ?? "").trim();
  return site ? `${testName} · ${site}` : testName;
}

export function siteFromSnapshot(nameSnapshot: string) {
  const idx = nameSnapshot.indexOf(" · ");
  return idx >= 0 ? nameSnapshot.slice(idx + 3) : null;
}

export function parseInvestigationPicks(body: { testIds?: unknown; investigations?: unknown }): InvestigationPick[] {
  if (Array.isArray(body?.investigations)) {
    const picks: InvestigationPick[] = [];
    const seen = new Set<string>();
    for (const row of body.investigations) {
      if (!row || typeof row !== "object") continue;
      const testId = String((row as { testId?: unknown }).testId ?? "").trim();
      if (!testId) continue;
      const siteLabel = String((row as { siteLabel?: unknown }).siteLabel ?? "").trim() || null;
      const key = `${testId}::${siteLabel ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push({ testId, siteLabel });
    }
    return picks;
  }
  if (Array.isArray(body?.testIds)) {
    return [...new Set(body.testIds.map((id: unknown) => String(id)))].filter(Boolean).map((testId) => ({ testId }));
  }
  return [];
}

export function prettyLabStatus(status: string) {
  if (status === "AWAITING_EXTERNAL_REPORT") return "Waiting for outside report";
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export { labStatusClass } from "@/lib/ui";
