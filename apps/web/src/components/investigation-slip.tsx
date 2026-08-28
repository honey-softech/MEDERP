import { SignatureBlock } from "@/components/signature-block";

type SlipItem = {
  name: string;
  category: string;
  outside: boolean;
};

export function InvestigationSlip({
  hospitalName,
  hospitalAddress,
  hospitalPhone,
  logoData,
  patientName,
  mrn,
  ageGender,
  phone,
  doctor,
  department,
  visitDate,
  token,
  items,
  printedBy,
  printedAt,
  signatureImage,
  signatureName,
  signatureCredentials,
}: {
  hospitalName: string;
  hospitalAddress: string | null;
  hospitalPhone: string | null;
  logoData: string | null;
  patientName: string;
  mrn: string;
  ageGender: string;
  phone: string;
  doctor: string;
  department: string;
  visitDate: string;
  token: string;
  items: SlipItem[];
  printedBy: string;
  printedAt: string;
  signatureImage?: string | null;
  signatureName?: string | null;
  signatureCredentials?: string | null;
}) {
  const outside = items.some((item) => item.outside);

  return (
    <article className="visit-summary-print">
      <header className="vs-letterhead">
        <div className="vs-letterhead-left">
          {logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt="" className="vs-mark" />
          ) : (
            <div className="vs-mark vs-mark-fallback">{hospitalName.slice(0, 1)}</div>
          )}
          <div>
            <p className="vs-kicker">Investigation request</p>
            <p className="vs-hospital">{hospitalName}</p>
            {hospitalAddress ? <p className="vs-meta">{hospitalAddress}</p> : null}
            {hospitalPhone ? <p className="vs-meta">{hospitalPhone}</p> : null}
          </div>
        </div>
      </header>

      <section className="mt-4 grid gap-1 text-sm">
        <p>
          <span className="text-slate-500">Patient · </span>
          <strong>{patientName}</strong> · {mrn} · {ageGender}
        </p>
        {phone ? (
          <p>
            <span className="text-slate-500">Phone · </span>
            {phone}
          </p>
        ) : null}
        <p>
          <span className="text-slate-500">Doctor · </span>
          {doctor} · {department}
        </p>
        <p>
          <span className="text-slate-500">Visit · </span>
          {visitDate}
          {token ? ` · Token ${token}` : ""}
        </p>
      </section>

      <h2 className="mt-4 text-sm font-semibold">Tests / scans</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No tests or scans on this visit yet.</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-2">Test / scan</th>
              <th className="py-1.5 pr-2">Category</th>
              <th className="py-1.5">Where</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.name}-${index}`} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium">{item.name}</td>
                <td className="py-1.5 pr-2 text-slate-600">{item.category}</td>
                <td className="py-1.5">{item.outside ? "Outside" : "Hospital lab"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {outside ? (
        <p className="mt-3 text-xs text-slate-600">Complete outside tests and bring the reports to the hospital.</p>
      ) : null}

      <section className="vs-signoff">
        <SignatureBlock
          role="Ordering physician"
          name={signatureName || doctor}
          credentials={signatureCredentials}
          imageData={signatureImage}
          note="Electronically authorised investigation request"
        />
      </section>

      <footer className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
        <span>Printed by: {printedBy}</span>
        <span>Printed on: {printedAt}</span>
      </footer>
    </article>
  );
}
