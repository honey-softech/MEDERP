export const SCRIBE_TOPICS = [
  "chiefComplaint",
  "history",
  "examination",
  "diagnosis",
  "medicines",
  "advice",
  "followUp",
] as const;

export type ScribeTopic = (typeof SCRIBE_TOPICS)[number];

export const TOPIC_LABELS: Record<ScribeTopic, string> = {
  chiefComplaint: "Chief complaint",
  history: "Duration",
  examination: "Examination",
  diagnosis: "Diagnosis",
  medicines: "Medicines with dose",
  advice: "Advice",
  followUp: "Follow-up",
};

const TERMS: Record<ScribeTopic, readonly string[]> = {
  chiefComplaint: [
    "headache",
    "pain",
    "fever",
    "cough",
    "cold",
    "vomit",
    "nausea",
    "complaint",
    "thalavali",
    "thalaivali",
    "thala vali",
    "vali",
    "வலி",
    "தலைவலி",
    "காய்ச்சல்",
    "இருமல்",
  ],
  history: ["how long", "since", "days", "weeks", "months", "duration", "onset", "நாள்", "வாரம்", "எவ்வளவு", "நாளாக"],
  examination: ["exam", "examination", "bp", "pulse", "temperature", "throat", "chest", "abdomen", "பரிசோதனை"],
  diagnosis: ["diagnosis", "diagnosed", "infection", "viral", "நோய்"],
  medicines: [
    "medicine",
    "tablet",
    "capsule",
    "syrup",
    "dose",
    " mg",
    "morning",
    "afternoon",
    "night",
    "மருந்து",
    "மாத்திரை",
    "காலை",
    "மதியம்",
    "இரவு",
    "marundhu",
    "mathirai",
  ],
  advice: ["advice", "rest", "drink", "avoid", "அறிவுரை"],
  followUp: ["follow up", "follow-up", "review", "come back", "days later", "மறுபரிசோதனை"],
};

const TERM_LIST = SCRIBE_TOPICS.map((topic, index) => ({
  bit: 1 << index,
  terms: TERMS[topic],
}));

export function emptyCoverage() {
  return 0;
}

export function topicBit(topic: ScribeTopic) {
  return 1 << SCRIBE_TOPICS.indexOf(topic);
}

export function topicHeard(mask: number, topic: ScribeTopic) {
  return (mask & topicBit(topic)) !== 0;
}

/** Scan one new line. Already-heard topics are skipped. */
export function coverText(mask: number, text: string) {
  const hay = text.toLowerCase();
  if (!hay) return mask;
  let next = mask;
  for (const topic of TERM_LIST) {
    if (next & topic.bit) continue;
    if (topic.terms.some((term) => hay.includes(term))) next |= topic.bit;
  }
  return next;
}

export function markAsked(mask: number, topic: ScribeTopic) {
  return mask | topicBit(topic);
}

export function nextMissing(mask: number): ScribeTopic | null {
  for (const topic of SCRIBE_TOPICS) {
    if (!topicHeard(mask, topic)) return topic;
  }
  return null;
}
