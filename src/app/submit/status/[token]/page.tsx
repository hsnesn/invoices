import { TrtLogo } from "@/components/TrtLogo";
import { GuestInvoiceStatusClient } from "./GuestInvoiceStatusClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function GuestInvoiceStatusPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-md">
        <div className="flex justify-center mb-6">
          <TrtLogo size="md" />
        </div>
        <GuestInvoiceStatusClient token={token} />
      </div>
    </div>
  );
}
