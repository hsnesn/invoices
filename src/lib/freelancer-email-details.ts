import type { FreelancerEmailDetails } from "@/lib/email";

type FlFields = {
  contractor_name: string | null;
  company_name: string | null;
  service_description: string | null;
  service_days_count: number | null;
  service_rate_per_day: number | null;
  service_month: string | null;
  additional_cost: number | null;
};

type ExtFields = {
  invoice_number: string | null;
  beneficiary_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  gross_amount: number | null;
};

/** Company name if valid (not empty, not TRT), else contractor name. */
export function getCompanyOrPerson(fl: FlFields | null): string {
  if (!fl) return "Invoice";
  const company = (fl.company_name ?? "").trim();
  const contractor = (fl.contractor_name ?? "").trim();
  if (company && !/trt/i.test(company)) return company;
  return contractor || "Invoice";
}

/** Build FreelancerEmailDetails for email subject and body. */
export function buildFreelancerEmailDetails(
  fl: FlFields | null,
  ext: ExtFields | null,
  departmentName: string
): FreelancerEmailDetails {
  const days = fl?.service_days_count ?? null;
  const rate = fl?.service_rate_per_day ?? null;
  const addCost = fl?.additional_cost ?? null;
  const gross = ext?.gross_amount;
  const total =
    gross != null && Number.isFinite(gross)
      ? `£${gross.toFixed(2)}`
      : days != null && rate != null
      ? `£${(days * rate + (addCost ?? 0)).toFixed(2)}`
      : "—";

  const companyOrPerson = getCompanyOrPerson(fl);
  const monthYear = (fl?.service_month ?? "").trim() || "—";

  return {
    companyOrPerson,
    monthYear,
    invoiceType: "Contractor",
    invoiceNumber: (ext?.invoice_number ?? "").trim() || "—",
    department: departmentName || "—",
    contractor: (fl?.contractor_name ?? "").trim() || "—",
    company: (fl?.company_name ?? "").trim() || "—",
    serviceDescription: (fl?.service_description ?? "").trim() || "—",
    month: (fl?.service_month ?? "").trim() || "—",
    daysCount: days,
    ratePerDay: rate,
    additionalCost: addCost,
    totalAmount: total,
    beneficiary: (ext?.beneficiary_name ?? "").trim() || "—",
    accountNumber: (ext?.account_number ?? "").trim() || "—",
    sortCode: (ext?.sort_code ?? "").trim() || "—",
  };
}
