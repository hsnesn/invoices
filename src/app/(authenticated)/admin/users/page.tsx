import { AdminUsersClient } from "./AdminUsersClient";
import { requireAdmin } from "@/lib/auth";

export default async function AdminUsersPage() {
  const { profile } = await requireAdmin();
  return <AdminUsersClient currentUserId={profile.id} />;
}
