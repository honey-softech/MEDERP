import { describe, expect, it } from "vitest";
import { relativeVisitLabel, vitalsDeltaLine, vitalsStrip, type PastVisitVitals } from "@/lib/appointments/past-visits";

const later: PastVisitVitals = {
  bpSystolic: 130,
  bpDiastolic: 86,
  pulseBpm: 78,
  temperatureC: 37.2,
  spo2Percent: 98,
  weightKg: 70.4,
};

const earlier: PastVisitVitals = {
  bpSystolic: 120,
  bpDiastolic: 80,
  pulseBpm: 78,
  temperatureC: 36.6,
  spo2Percent: 98,
  weightKg: 71.2,
};

describe("past visit reading", () => {
  it("says how long ago a visit was", () => {
    const now = Date.parse("2026-03-20T10:00:00+05:30");
    expect(relativeVisitLabel("2026-03-19T10:00:00+05:30", now)).toBe("Yesterday");
    expect(relativeVisitLabel("2026-02-27T10:00:00+05:30", now)).toBe("3 weeks ago");
  });

  it("puts the readings a doctor scans for on one line", () => {
    expect(vitalsStrip(later)).toBe("BP 130/86 · Pulse 78 · Temp 37.2° · SpO2 98% · Wt 70.4 kg");
    expect(vitalsStrip(null)).toBe("");
  });

  it("shows only the values that changed since the previous visit", () => {
    expect(vitalsDeltaLine(later, earlier)).toBe("Since last visit · BP +10/+6 · Temp +0.6° · Wt −0.8 kg");
    expect(vitalsDeltaLine(later, later)).toBe("");
    expect(vitalsDeltaLine(null, earlier)).toBe("");
  });
});
