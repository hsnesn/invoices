import { requirePageAccess } from "@/lib/auth";

export default async function OtherInvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("other_invoices");
  return <>{children}</>;
}
