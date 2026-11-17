export type SttExpect = {
  id: string;
  medicines: string[];
  symptoms: string[];
};

export function scoreTranscript(expect: SttExpect, transcript: string) {
  const haystack = transcript.toLowerCase();
  const missedMedicines = expect.medicines.filter((name) => name.trim() && !haystack.includes(name.trim().toLowerCase()));
  const missedSymptoms = expect.symptoms.filter((name) => name.trim() && !haystack.includes(name.trim().toLowerCase()));
  return { id: expect.id, missedMedicines, missedSymptoms };
}

export function scoreSttReport(rows: Array<ReturnType<typeof scoreTranscript>>) {
  return {
    clips: rows.length,
    wrongMedicines: rows.reduce((total, row) => total + row.missedMedicines.length, 0),
    missedSymptoms: rows.reduce((total, row) => total + row.missedSymptoms.length, 0),
    rows,
  };
}
