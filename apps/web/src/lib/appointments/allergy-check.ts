/**
 * Free-text allergy check against a drug name and salt.
 * Classes do not cross-react (penicillin does not warn on a cephalosporin).
 * A negative-only allergy note ("NKDA", "nil") stays silent.
 */

export type AllergyHit = {
  id: string;
  label: string;
};

type AllergenClass = {
  id: string;
  label: string;
  allergy: RegExp[];
  drug: RegExp[];
};

function patterns(...sources: string[]): RegExp[] {
  return sources.map((source) => new RegExp(source, "i"));
}

const NEGATIVE_ONLY =
  /^(?:nkda|nka|nil|none|no|nad|na|n\/a|unknown|not known|-|\.|no known(?: drug)? allerg(?:y|ies)|no known drug allergies|nil known)$/i;

const CLASSES: AllergenClass[] = [
  {
    id: "penicillins",
    label: "penicillin",
    allergy: patterns(
      "\\b(?:penicillins?|amoxycillins?|amoxicillins?|ampicillins?|cloxacillins?|piperacillins?|augmentin|amoxyclav)\\b",
    ),
    drug: patterns(
      "\\b(?:penicillin|amoxycillin|amoxicillin|ampicillin|cloxacillin|piperacillin|benzathine|phenoxymethylpenicillin)\\b",
    ),
  },
  {
    id: "cephalosporins",
    label: "cephalosporin",
    allergy: patterns("\\b(?:cephalosporins?|cef[a-z]+)\\b"),
    drug: patterns("\\b(?:cephalosporin|cef[a-z]+)\\b"),
  },
  {
    id: "carbapenems",
    label: "carbapenem",
    allergy: patterns("\\b(?:carbapenems?|meropenem|imipenem|ertapenem|doripenem)\\b"),
    drug: patterns("\\b(?:meropenem|imipenem|ertapenem|doripenem)\\b"),
  },
  {
    id: "sulfonamides",
    label: "sulfa",
    allergy: patterns(
      "\\b(?:sulfa|sulpha|sulfonamides?|sulphonamides?|sulfamethoxazole|sulphamethoxazole|co-?trimoxazole|septran|bactrim)\\b",
    ),
    drug: patterns(
      "\\b(?:sulfamethoxazole|sulphamethoxazole|sulfadiazine|sulphadiazine|sulfadoxine|sulphadoxine|sulfasalazine|sulphasalazine)\\b",
    ),
  },
  {
    id: "nsaids",
    label: "NSAID",
    allergy: patterns(
      "\\b(?:nsaids?|ibuprofen|brufen|diclofenac|aspirin|disprin|acetylsalicylic|aceclofenac|naproxen|mefenamic|meftal|ketorolac|piroxicam|nimesulide|indomethacin|etoricoxib|combiflam)\\b",
    ),
    drug: patterns(
      "\\b(?:ibuprofen|diclofenac|aspirin|acetylsalicylic|aceclofenac|naproxen|mefenamic|ketorolac|piroxicam|nimesulide|indomethacin|etoricoxib)\\b",
    ),
  },
  {
    id: "macrolides",
    label: "macrolide",
    allergy: patterns("\\b(?:macrolides?|azithromycin|erythromycin|clarithromycin|roxithromycin)\\b"),
    drug: patterns("\\b(?:azithromycin|erythromycin|clarithromycin|roxithromycin)\\b"),
  },
  {
    id: "fluoroquinolones",
    label: "quinolone",
    allergy: patterns(
      "\\b(?:fluoroquinolones?|quinolones?|cipro|ciprofloxacin|levofloxacin|ofloxacin|norfloxacin|moxifloxacin|gemifloxacin)\\b",
    ),
    drug: patterns("\\b(?:ciprofloxacin|levofloxacin|ofloxacin|norfloxacin|moxifloxacin|gemifloxacin)\\b"),
  },
  {
    id: "tetracyclines",
    label: "tetracycline",
    allergy: patterns("\\b(?:tetracyclines?|doxycycline|minocycline)\\b"),
    drug: patterns("\\b(?:tetracycline|doxycycline|minocycline)\\b"),
  },
  {
    id: "aminoglycosides",
    label: "aminoglycoside",
    allergy: patterns("\\b(?:aminoglycosides?|gentamicin|amikacin|tobramycin|netilmicin|streptomycin|neomycin)\\b"),
    drug: patterns("\\b(?:gentamicin|amikacin|tobramycin|netilmicin|streptomycin|neomycin)\\b"),
  },
  {
    id: "lincosamides",
    label: "lincosamide",
    allergy: patterns("\\b(?:lincosamides?|clindamycin|lincomycin)\\b"),
    drug: patterns("\\b(?:clindamycin|lincomycin)\\b"),
  },
  {
    id: "nitroimidazoles",
    label: "nitroimidazole",
    allergy: patterns("\\b(?:nitroimidazoles?|metronidazole|tinidazole|ornidazole|secnidazole)\\b"),
    drug: patterns("\\b(?:metronidazole|tinidazole|ornidazole|secnidazole)\\b"),
  },
  {
    id: "statins",
    label: "statin",
    allergy: patterns("\\b(?:statins?|atorvastatin|rosuvastatin|simvastatin|pravastatin|fluvastatin|pitavastatin|lovastatin)\\b"),
    drug: patterns("\\b(?:atorvastatin|rosuvastatin|simvastatin|pravastatin|fluvastatin|pitavastatin|lovastatin)\\b"),
  },
  {
    id: "ace-inhibitors",
    label: "ACE inhibitor",
    allergy: patterns("\\b(?:ace inhibitors?|enalapril|ramipril|lisinopril|perindopril|captopril)\\b"),
    drug: patterns("\\b(?:enalapril|ramipril|lisinopril|perindopril|captopril|quinapril|benazepril|fosinopril)\\b"),
  },
  {
    id: "arbs",
    label: "ARB",
    allergy: patterns("\\b(?:arbs?|angiotensin receptor|losartan|telmisartan|olmesartan|valsartan)\\b"),
    drug: patterns("\\b(?:losartan|telmisartan|olmesartan|valsartan|irbesartan|candesartan)\\b"),
  },
  {
    id: "opioids",
    label: "opioid",
    allergy: patterns("\\b(?:opioids?|opiates?|opium|morphine|codeine|tramadol|fentanyl|pethidine|buprenorphine)\\b"),
    drug: patterns("\\b(?:morphine|codeine|tramadol|fentanyl|pethidine|buprenorphine)\\b"),
  },
  {
    id: "iodine",
    label: "iodine",
    allergy: patterns("\\b(?:iodine|iodide|contrast(?: media)?|betadine)\\b"),
    drug: patterns("\\b(?:iodine|iodide|povidone-iodine|iopamidol|iohexol|amiodarone)\\b"),
  },
  {
    id: "local-anesthetics",
    label: "local anaesthetic",
    allergy: patterns("\\b(?:local anaesthetics?|local anesthetics?|lignocaine|lidocaine|xylocaine|bupivacaine)\\b"),
    drug: patterns("\\b(?:lignocaine|lidocaine|bupivacaine)\\b"),
  },
  {
    id: "rifampicin",
    label: "rifampicin",
    allergy: patterns("\\b(?:rifampicin|rifampin)\\b"),
    drug: patterns("\\b(?:rifampicin|rifampin)\\b"),
  },
  {
    id: "isoniazid",
    label: "isoniazid",
    allergy: patterns("\\bisoniazid\\b"),
    drug: patterns("\\bisoniazid\\b"),
  },
  {
    id: "phenytoin",
    label: "phenytoin",
    allergy: patterns("\\bphenytoin\\b"),
    drug: patterns("\\bphenytoin\\b"),
  },
  {
    id: "carbamazepine",
    label: "carbamazepine",
    allergy: patterns("\\bcarbamazepine\\b"),
    drug: patterns("\\bcarbamazepine\\b"),
  },
  {
    id: "allopurinol",
    label: "allopurinol",
    allergy: patterns("\\ballopurinol\\b"),
    drug: patterns("\\ballopurinol\\b"),
  },
];

export function checkAllergy(
  allergyText: string | null | undefined,
  drug: { name?: string | null; salt?: string | null },
): AllergyHit | null {
  const allergy = (allergyText ?? "").trim();
  if (!allergy || NEGATIVE_ONLY.test(allergy)) return null;
  const haystack = `${drug.name ?? ""} ${drug.salt ?? ""}`.trim();
  if (!haystack) return null;
  for (const klass of CLASSES) {
    const allergyHit = klass.allergy.some((pattern) => pattern.test(allergy));
    const drugHit = klass.drug.some((pattern) => pattern.test(haystack));
    if (allergyHit && drugHit) return { id: klass.id, label: klass.label };
  }
  return null;
}
