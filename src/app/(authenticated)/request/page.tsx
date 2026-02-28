import { requirePageAccess } from "@/lib/auth";
import { RequestClient } from "./RequestClient";

export default async function RequestPage() {
  await requirePageAccess("request");
  return (
    <div className="mx-auto max-w-5xl min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Request</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Enter daily requirements (demand), compare with freelancer availability (supply), then run AI to match.
      </p>
      <RequestClient />
    </div>
  );
}
