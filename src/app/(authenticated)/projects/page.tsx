import { requirePageAccess } from "@/lib/auth";
import { ProjectsClient } from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requirePageAccess("projects");
  return (
    <div className="mx-auto max-w-6xl min-w-0 w-full overflow-x-hidden px-1 sm:px-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Projects</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
          Track projects and link them to office requests and invoices.
        </p>
      </div>
      <ProjectsClient />
    </div>
  );
}
