import { parseMedications, readableClinicalText } from "@/lib/visit-summary";

export function VisitSummaryDocument({
  hospitalName,
  hospitalAddress,
  hospitalPhone,
  logoData,
  sealData,
  patientName,
  mrn,
  ageGender,
  encounterNo,
  appointmentType,
  visitDate,
  physician,
  departmentName,
  diagnosis,
  chiefComplaint,
  history,
  generalExamination,
  vitalsRows,
  systemicExamination,
  advice,
  followUpAt,
  visitOutcome,
  prescription,
  printedBy,
  printedAt,
  draft,
}: {
  hospitalName: string;
  hospitalAddress?: string | null;
  hospitalPhone?: string | null;
  logoData?: string | null;
  sealData?: string | null;
  patientName: string;
  mrn: string;
  ageGender: string;
  encounterNo: string;
  appointmentType: string;
  visitDate: string;
  physician: string;
  departmentName: string;
  diagnosis?: string | null;
  chiefComplaint?: string | null;
  history?: string | null;
  generalExamination?: string | null;
  vitalsRows?: { label: string; value: string }[];
  systemicExamination?: string | null;
  advice?: string | null;
  followUpAt?: string | null;
  visitOutcome?: string | null;
  prescription?: string | null;
  printedBy: string;
  printedAt: string;
  draft?: boolean;
}) {
  const medicines = parseMedications(readableClinicalText(prescription));
  const vitals =
    vitalsRows && vitalsRows.length > 0
      ? vitalsRows
      : labeledLines(generalExamination).length
        ? labeledLines(generalExamination)
        : emptyVitalRows();

  return (
    <article className="visit-summary-print">
      {draft ? (
        <p className="vs-draft">Draft preview — approve to release for reception print</p>
      ) : null}

      <header className="vs-letterhead">
        <div className="vs-letterhead-left">
          {sealData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sealData} alt="" className="vs-mark" />
          ) : (
            <div className="vs-mark vs-mark-fallback" aria-hidden>
              +
            </div>
          )}
          <div>
            <p className="vs-kicker">Outpatient record</p>
            <h1>Visit summary</h1>
          </div>
        </div>
        <div className="vs-letterhead-right">
          <div>
            <p className="vs-hospital">{hospitalName}</p>
            {hospitalAddress ? <p className="vs-meta">{hospitalAddress}</p> : null}
            {hospitalPhone ? <p className="vs-meta">{hospitalPhone}</p> : null}
          </div>
          {logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt={hospitalName} className="vs-mark" />
          ) : null}
        </div>
      </header>

      <section className="vs-identity">
        <div className="vs-identity-top">
          <Field label="Name" value={patientName} strong />
          <Field label="Age / gender" value={ageGender} />
          <Field label="Encounter no." value={encounterNo} mono />
          <Field label="UHID" value={mrn} mono />
        </div>
        <div className="vs-identity-bottom">
          <Field label="Appointment type" value={appointmentType} />
          <Field label="Date" value={visitDate} />
          <Field label="Consulting physician" value={physician} wide />
          <Field label="Department" value={departmentName} wide />
        </div>
      </section>

      <section className="vs-diagnosis">
        <p className="vs-label">Final diagnosis</p>
        <p className="vs-diagnosis-value">{readableClinicalText(diagnosis) || "—"}</p>
      </section>

      <Section title="Presenting complaints" body={chiefComplaint} />
      <Section title="History of present illness" body={history} />

      <section className="vs-section">
        <h2>General examination</h2>
        {vitalBands(vitals).map((band, index) => (
          <table key={index} className="vs-vitals-strip">
            <thead>
              <tr>
                {band.map((row) => (
                  <th key={row.label}>{row.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {band.map((row) => (
                  <td key={row.label} className={row.value === "—" ? "vs-empty-value" : undefined}>
                    {row.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ))}
        {vitals
          .filter((row) => row.label === "Vital remarks")
          .map((row) => (
            <p key={row.label} className="vs-remarks">
              <span className="vs-label">Vital remarks</span>
              <span className={row.value === "—" ? "vs-empty" : "vs-body"}>{row.value}</span>
            </p>
          ))}
      </section>

      <Section title="Systemic examination" body={systemicExamination} />
      <Section title="Advice" body={advice} accent />
      {visitOutcome === "DISCHARGE" ? (
        <Section title="Outcome" body="Discharged" />
      ) : followUpAt ? (
        <Section title="Follow-up" body={followUpAt} />
      ) : visitOutcome === "FOLLOW_UP" ? (
        <Section title="Outcome" body="Follow up" />
      ) : null}
      <Section title="Lab report" body="" />

      <section className="vs-section">
        <h2>Medications</h2>
        <table className="vs-table">
          <thead>
            <tr>
              <th className="vs-num">#</th>
              <th>Drug name</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {medicines.length === 0 ? (
              <tr>
                <td colSpan={3} className="vs-empty">
                  No medicines recorded.
                </td>
              </tr>
            ) : (
              medicines.map((row, index) => (
                <tr key={`${row.name}-${row.notes}-${index}`}>
                  <td className="vs-num">{index + 1}</td>
                  <td className="vs-drug">{row.name}</td>
                  <td>{row.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="vs-signoff">
        <div>
          <p className="vs-label">Consulting physician</p>
          <p className="vs-sign-name">{physician}</p>
          <p className="vs-sign-line">Electronically authorised visit summary</p>
        </div>
        <div className="vs-stamp">{draft ? "DRAFT" : "APPROVED"}</div>
      </section>

      <footer className="vs-footer">
        <span>Printed by: {printedBy}</span>
        <span>Page 1/1</span>
        <span>Printed on: {printedAt}</span>
      </footer>
    </article>
  );
}

function Field({
  label,
  value,
  strong,
  mono,
  wide,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <p className={wide ? "vs-field vs-wide" : "vs-field"}>
      <span className="vs-label">{label}</span>
      <span className={`${strong ? "vs-strong" : ""} ${mono ? "vs-mono" : ""}`.trim()}>{value}</span>
    </p>
  );
}

function Section({ title, body, accent }: { title: string; body?: string | null; accent?: boolean }) {
  const text = readableClinicalText(body);
  return (
    <section className={accent ? "vs-section vs-advice" : "vs-section"}>
      <h2>{title}</h2>
      <p className={text ? "vs-body" : "vs-empty"}>{text || "—"}</p>
    </section>
  );
}

function vitalBands(rows: { label: string; value: string }[]) {
  const compact = rows.filter((row) => row.label !== "Vital remarks");
  const mid = Math.ceil(compact.length / 2);
  return [compact.slice(0, mid), compact.slice(mid)].filter((band) => band.length > 0);
}

function emptyVitalRows() {
  return [
    "Temperature",
    "Height",
    "Weight",
    "BMI",
    "BSA",
    "SpO2",
    "Pulse",
    "Respiratory rate",
    "BP",
    "Blood sugar",
    "Fever",
    "Vital remarks",
  ].map((label) => ({ label, value: "—" }));
}

function labeledLines(text?: string | null) {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(":");
      if (index === -1) return { label: "", value: line };
      return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
    });
}
