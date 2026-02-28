import { requirePageAccess } from "@/lib/auth";
import { RequestPageClient } from "./RequestPageClient";

export default async function RequestPage() {
  await requirePageAccess("request");
  return (
    <div className="mx-auto max-w-5xl min-w-0 w-full overflow-x-hidden px-1 sm:px-0">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Request</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
          Plan daily staffing needs by role, compare with contractor availability, and use AI to suggest assignments.
        </p>
      </div>
      <RequestPageClient />
    </div>
  );
}
