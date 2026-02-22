import { requireAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();
  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950">
      <Nav profile={profile} />
      <main className="p-6">{children}</main>
    </div>
  );
}
