import { requireAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Breadcrumb } from "@/components/Breadcrumb";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { FooterShortcutTrigger } from "@/components/FooterShortcutTrigger";
import { InvoiceToastListener } from "@/components/InvoiceToastListener";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-slate-950">
      <KeyboardShortcuts />
      <Nav profile={profile} />
      <main className="flex-1 p-4 sm:p-6 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto">
        <InvoiceToastListener />
        <Breadcrumb />
        {children}
      </main>
      <footer className="border-t border-gray-200/60 py-3 dark:border-gray-700/40">
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          By Hasan Esen · Press <FooterShortcutTrigger />
        </p>
      </footer>
    </div>
  );
}
