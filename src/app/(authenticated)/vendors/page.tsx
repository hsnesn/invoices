import { requirePageAccess } from "@/lib/auth";
import { VendorsSetupSection } from "@/components/VendorsSetupSection";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const { profile } = await requirePageAccess("vendors");
  return (
    <div className="mx-auto max-w-6xl min-w-0 w-full overflow-x-hidden px-1 sm:px-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Vendors & Suppliers</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
          Manage vendor/supplier contacts, contract dates and payment terms.
        </p>
      </div>
      <VendorsSetupSection canDelete={profile.role === "admin"} />
    </div>
  );
}
