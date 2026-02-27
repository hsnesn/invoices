/**
 * Returns the invoice list URL with expand param so the row is expanded on load.
 * guest/salary -> /invoices, freelancer -> /freelancer-invoices, other -> /other-invoices
 */
export function invoiceListUrl(invoiceId: string, invoiceType: string | null): string {
  const type = (invoiceType ?? "guest").toLowerCase();
  if (type === "freelancer") return `/freelancer-invoices?expand=${invoiceId}`;
  if (type === "other") return `/other-invoices?expand=${invoiceId}`;
  return `/invoices?expand=${invoiceId}`;
}
