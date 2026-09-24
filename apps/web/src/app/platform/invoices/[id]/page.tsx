import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformBillingSettings } from "@/lib/platform-billing";
import { prisma } from "@/lib/prisma";

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export default async function PlatformInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const { id } = await params;
  const invoice = await prisma.platformInvoice.findUnique({
    where: { id },
    include: { items: true, hospital: true },
  });
  const settings = invoice?.issuerName
    ? null
    : await getPlatformBillingSettings();
  const issuer = {
    companyName: invoice?.issuerName || settings?.companyName || "",
    companyAddress: invoice?.issuerName ? invoice.issuerAddress : settings?.companyAddress,
    companyPhone: invoice?.issuerName ? invoice.issuerPhone : settings?.companyPhone,
    companyEmail: invoice?.issuerName ? invoice.issuerEmail : settings?.companyEmail,
    gstin: invoice?.issuerName ? invoice.issuerGstin : settings?.gstin,
    bankDetails: invoice?.issuerName ? invoice.issuerBankDetails : settings?.bankDetails,
    termsNote: invoice?.issuerName ? invoice.issuerTermsNote : settings?.termsNote,
  };
  const billed = {
    name: invoice?.billedHospitalName || invoice?.hospital.name || "",
    code: invoice?.billedHospitalCode || invoice?.hospital.code || "",
    address: invoice?.billedHospitalName ? invoice.billedHospitalAddress : invoice?.hospital.address,
    phone: invoice?.billedHospitalName ? invoice.billedHospitalPhone : invoice?.hospital.phone,
  };

  if (!invoice) notFound();
  if (actor.role !== "SOFTWARE_ADMIN" && !(actor.role === "SUPER_ADMIN" && actor.hospitalId === invoice.hospitalId)) {
    notFound();
  }

  return (
    <AppShell title={`Invoice ${invoice.invoiceNo}`}>
      <div className="mb-4 print:hidden">
        <Link
          href={actor.role === "SOFTWARE_ADMIN" ? `/platform/hospitals/${invoice.hospitalId}` : "/hospital/subscription"}
          className="text-sm text-teal-700 hover:underline"
        >
          ← {invoice.hospital.name}
        </Link>
      </div>

      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-semibold">{issuer.companyName}</h2>
            {issuer.companyAddress ? <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{issuer.companyAddress}</p> : null}
            <p className="mt-1 text-sm text-slate-600">
              {[issuer.companyPhone, issuer.companyEmail, issuer.gstin ? `GSTIN ${issuer.gstin}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">TAX INVOICE</p>
            <p className="font-mono">{invoice.invoiceNo}</p>
            <p className="text-slate-600">
              {invoice.issuedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
            <p className="mt-1 font-medium text-teal-800">{invoice.status}</p>
          </div>
        </header>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Bill to</p>
            <p className="font-semibold">{billed.name}</p>
            <p className="font-mono text-slate-600">{billed.code}</p>
            {billed.address ? <p className="text-slate-600">{billed.address}</p> : null}
            {billed.phone ? <p className="text-slate-600">{billed.phone}</p> : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
            <p>{invoice.paymentMethod ?? "—"}</p>
            {invoice.paidAt ? (
              <p className="text-slate-600">
                Paid {invoice.paidAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            ) : null}
            {invoice.notes ? <p className="text-slate-600">{invoice.notes}</p> : null}
          </div>
        </section>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{inr(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-semibold">Total</td>
              <td className="pt-3 text-right font-semibold">{inr(Number(invoice.netTotal))}</td>
            </tr>
          </tfoot>
        </table>

        {issuer.bankDetails ? (
          <p className="mt-6 text-sm text-slate-600 whitespace-pre-line">
            <span className="font-medium">Bank / UPI:</span>
            {"\n"}
            {issuer.bankDetails}
          </p>
        ) : null}
        {issuer.termsNote ? (
          <p className="mt-4 text-xs text-slate-500 whitespace-pre-line">{issuer.termsNote}</p>
        ) : null}
      </article>
    </AppShell>
  );
}
