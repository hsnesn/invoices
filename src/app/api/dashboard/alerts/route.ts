/**
 * Dashboard proactive alerts: recurring invoices due soon, reminders due, projects at risk.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DAYS_AHEAD = 14; // recurring invoices & reminders due within 14 days
const PROJECT_DAYS_AT_RISK = 7; // projects with deadline within 7 days

export async function GET() {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();

    const today = new Date().toISOString().slice(0, 10);
    const future = new Date();
    future.setDate(future.getDate() + DAYS_AHEAD);
    const futureStr = future.toISOString().slice(0, 10);

    const projectRisk = new Date();
    projectRisk.setDate(projectRisk.getDate() + PROJECT_DAYS_AT_RISK);
    const projectRiskStr = projectRisk.toISOString().slice(0, 10);

    const alerts: { type: string; title: string; href: string; count?: number; items?: { title: string; due?: string }[] }[] = [];

    // Recurring invoices due soon
    const { data: recurring } = await supabase
      .from("recurring_invoices")
      .select("id, title, next_due_date")
      .eq("is_active", true)
      .gte("next_due_date", today)
      .lte("next_due_date", futureStr)
      .order("next_due_date", { ascending: true })
      .limit(10);

    if (recurring && recurring.length > 0) {
      alerts.push({
        type: "recurring",
        title: "Recurring invoices due soon",
        href: "/admin/setup",
        count: recurring.length,
        items: recurring.map((r: { title: string; next_due_date: string }) => ({
          title: r.title,
          due: r.next_due_date,
        })),
      });
    }

    // Reminders due
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, next_due_date")
      .eq("is_active", true)
      .gte("next_due_date", today)
      .lte("next_due_date", futureStr)
      .order("next_due_date", { ascending: true })
      .limit(10);

    if (reminders && reminders.length > 0) {
      alerts.push({
        type: "reminders",
        title: "Reminders due",
        href: "/office-requests",
        count: reminders.length,
        items: reminders.map((r: { title: string; next_due_date: string }) => ({
          title: r.title,
          due: r.next_due_date,
        })),
      });
    }

    // Projects at risk (deadline within 7 days)
    const canSeeProjects = ["admin", "operations", "manager", "finance", "viewer"].includes(profile.role);
    if (canSeeProjects) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, deadline")
        .eq("status", "active")
        .not("deadline", "is", null)
        .gte("deadline", today)
        .lte("deadline", projectRiskStr)
        .order("deadline", { ascending: true })
        .limit(10);

      if (projects && projects.length > 0) {
        alerts.push({
          type: "projects",
          title: "Projects at risk (deadline soon)",
          href: "/projects",
          count: projects.length,
          items: projects.map((p: { name: string; deadline: string }) => ({
            title: p.name,
            due: p.deadline,
          })),
        });
      }
    }

    return NextResponse.json({ alerts });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
