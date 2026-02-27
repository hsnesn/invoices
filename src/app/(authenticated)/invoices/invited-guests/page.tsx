import { requirePageAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvitedGuestsClient } from "./InvitedGuestsClient";

export const dynamic = "force-dynamic";

export default async function InvitedGuestsPage() {
  const { session, profile } = await requirePageAccess("guest_invoices");
  const supabase = createAdminClient();

  const [{ data: programs }, { data: producers }, { data: titles }] = await Promise.all([
    supabase.from("programs").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("guest_titles").select("id, name").order("name"),
  ]);

  const producerProgramId = Array.isArray(profile.program_ids) && profile.program_ids.length > 0 ? profile.program_ids[0] : null;
  const defaultProgramName = producerProgramId
    ? (programs ?? []).find((p) => p.id === producerProgramId)?.name ?? ""
    : "";

  return (
    <InvitedGuestsClient
      programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name }))}
      producers={(producers ?? []).map((p) => ({ id: p.id, full_name: p.full_name || "Unknown" }))}
      titles={(titles ?? []).map((t) => t.name)}
      defaultProgramName={defaultProgramName}
      currentUserId={session.user.id}
      currentUserFullName={profile.full_name ?? ""}
      isAdmin={profile.role === "admin"}
    />
  );
}
