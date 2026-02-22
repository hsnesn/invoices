import { AdminUsersClient } from "./AdminUsersClient";
import { requireDevAdmin } from "@/lib/auth";

export default async function AdminUsersPage() {
  const { profile } = await requireDevAdmin();
  return <AdminUsersClient currentUserId={profile.id} />;
}
