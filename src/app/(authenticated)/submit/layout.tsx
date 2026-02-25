import { requirePageAccess } from "@/lib/auth";

export default async function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("submit_invoice");
  return <>{children}</>;
}
