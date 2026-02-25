import { requirePageAccess } from "@/lib/auth";

export default async function FreelancerInvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("freelancer_invoices");
  return <>{children}</>;
}
