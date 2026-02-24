import { requireAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Breadcrumb } from "@/components/Breadcrumb";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-slate-950">
      <Nav profile={profile} />
      <main className="flex-1 p-6">
        <Breadcrumb />
        {children}
      </main>
      <footer className="border-t border-gray-200/60 py-3 dark:border-gray-700/40">
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          By Hasan Esen
        </p>
      </footer>
    </div>
  );
}
