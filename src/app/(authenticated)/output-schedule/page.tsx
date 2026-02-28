import { requirePageAccess } from "@/lib/auth";
import { OutputScheduleClient } from "./OutputScheduleClient";

export default async function OutputSchedulePage() {
  await requirePageAccess("output_schedule");
  return (
    <div className="mx-auto max-w-5xl min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Output Schedule</h1>
      <OutputScheduleClient />
    </div>
  );
}
