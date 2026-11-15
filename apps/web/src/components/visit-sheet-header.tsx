export type VisitSheetHeaderProps = {
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
  vitalsRows?: { label: string; value: string }[];
  title?: string;
};

export function VisitSheetHeader({
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
  vitalsRows,
  title = "Visit summary",
}: VisitSheetHeaderProps) {
  const vitals =
    vitalsRows && vitalsRows.length > 0
      ? vitalsRows
      : [
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

  return (
    <>
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
        </div>
        <div className="vs-letterhead-center">
          <p className="vs-hospital">{hospitalName}</p>
          {hospitalAddress ? <p className="vs-meta">{hospitalAddress}</p> : null}
          {hospitalPhone ? <p className="vs-meta">{hospitalPhone}</p> : null}
        </div>
        <div className="vs-letterhead-right">
          {logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt={hospitalName} className="vs-logo" />
          ) : null}
        </div>
      </header>

      <h1 className="vs-title">{title}</h1>

      <section className="vs-top-stack">
        <section className="vs-identity">
          <div className="vs-identity-main">
            <p className="vs-patient-name">{patientName}</p>
            <p className="vs-patient-age">{ageGender}</p>
          </div>
          <div className="vs-identity-ids">
            <p className="vs-field">
              <span className="vs-label">Encounter no.</span>
              <span className="vs-mono">{encounterNo}</span>
            </p>
            <p className="vs-field">
              <span className="vs-label">UHID</span>
              <span className="vs-mono">{mrn}</span>
            </p>
          </div>
          <div className="vs-identity-meta">
            <p className="vs-field">
              <span className="vs-label">Appointment type</span>
              <span>{appointmentType}</span>
            </p>
            <p className="vs-field">
              <span className="vs-label">Date</span>
              <span>{visitDate}</span>
            </p>
            <p className="vs-field vs-wide">
              <span className="vs-label">Consulting physician</span>
              <span>{physician}</span>
            </p>
            <p className="vs-field vs-wide">
              <span className="vs-label">Department</span>
              <span>{departmentName}</span>
            </p>
          </div>
        </section>

        <section className="vs-exam-panel">
          <p className="vs-exam-title">General examination</p>
          <ul className="vs-vitals-list vs-vitals-compact">
            {vitals.map((row) => (
              <li key={row.label || row.value}>
                {row.label ? <span className="vs-vital-label">{row.label}</span> : null}
                <span className={row.value === "—" ? "vs-vital-empty" : "vs-vital-value"}>{row.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}
