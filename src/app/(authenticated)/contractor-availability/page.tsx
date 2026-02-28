import { requirePageAccess } from "@/lib/auth";
import { ContractorAvailabilityClient } from "./ContractorAvailabilityClient";

export default async function ContractorAvailabilityPage() {
  await requirePageAccess("contractor_availability");
  return (
    <div className="mx-auto max-w-5xl min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contractor Availability</h1>
      <ContractorAvailabilityClient />
    </div>
  );
}
