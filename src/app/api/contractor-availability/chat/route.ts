/**
 * Chat for contractor/freelancer scheduling.
 * Answers questions about who worked when, who's scheduled, requirements, etc.
 * Can suggest links to relevant pages.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function canAccess(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

async function fetchContext(supabase: ReturnType<typeof createAdminClient>, departmentId?: string | null) {
  const now = new Date();
  const months: { key: string; start: string; end: string; label: string }[] = [];
  for (let i = -1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const start = d.toISOString().slice(0, 10);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      start,
      end,
      label: d.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    });
  }

  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
  }

  const { data: depts } = await supabase.from("departments").select("id, name").order("sort_order").order("name");
  const departments = (depts ?? []) as { id: string; name: string }[];
  const defaultDeptId = departments[0]?.id ?? null;
  const deptId = departmentId && /^[0-9a-f-]{36}$/i.test(departmentId) ? departmentId : defaultDeptId;

  const assignmentsByMonth: Record<string, { date: string; role: string; name: string }[]> = {};
  const requirementsByMonth: Record<string, { date: string; role: string; count_needed: number }[]> = {};

  for (const m of months) {
    let assignQuery = supabase
      .from("output_schedule_assignments")
      .select("date, role, user_id")
      .gte("date", m.start)
      .lte("date", m.end)
      .in("status", ["pending", "confirmed"]);
    if (deptId) {
      assignQuery = assignQuery.eq("department_id", deptId);
    }
    const { data: assignRows } = await assignQuery;
    assignmentsByMonth[m.key] = (assignRows ?? []).map((a) => ({
      date: (a as { date: string }).date,
      role: (a as { role: string }).role ?? "",
      name: nameMap.get((a as { user_id: string }).user_id) ?? "Unknown",
    }));

    let reqQuery = supabase
      .from("contractor_availability_requirements")
      .select("date, role, count_needed")
      .gte("date", m.start)
      .lte("date", m.end);
    if (deptId) {
      reqQuery = reqQuery.eq("department_id", deptId);
    }
    const { data: reqRows } = await reqQuery;
    requirementsByMonth[m.key] = (reqRows ?? []).map((r) => ({
      date: (r as { date: string }).date,
      role: (r as { role: string }).role,
      count_needed: (r as { count_needed: number }).count_needed,
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let context = `You are a scheduling assistant for contractor/freelancer staffing. Today is ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

**Departments:** ${departments.map((d) => d.name).join(", ")}
**Default department for links:** ${deptId ? departments.find((d) => d.id === deptId)?.name ?? "first" : "none"}

**Assignments (who is scheduled):**
`;
  for (const m of months) {
    const byDate = new Map<string, { role: string; name: string }[]>();
    for (const a of assignmentsByMonth[m.key]) {
      if (!byDate.has(a.date)) byDate.set(a.date, []);
      byDate.get(a.date)!.push({ role: a.role, name: a.name });
    }
    const sorted = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const lines = sorted.map(
      ([d, arr]) =>
        `  ${m.label} ${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}: ${arr.map((x) => `${x.name} (${x.role || "—"})`).join(", ")}`
    );
    context += `${m.label}:\n${lines.length ? lines.join("\n") : "  (none)"}\n`;
  }

  context += `\n**Requirements (demand per day):**
`;
  for (const m of months) {
    const byDate = new Map<string, { role: string; count: number }[]>();
    for (const r of requirementsByMonth[m.key]) {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date)!.push({ role: r.role, count: r.count_needed });
    }
    const sorted = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const lines = sorted.map(
      ([d, arr]) =>
        `  ${m.label} ${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}: ${arr.map((x) => `${x.role}: ${x.count}`).join(", ")}`
    );
    context += `${m.label}:\n${lines.length ? lines.join("\n") : "  (none)"}\n`;
  }

  context += `\n**Useful links (use exact URLs):**
- Request page (set requirements): ${appUrl}/request?month=MONTH&dept=${deptId ?? ""}
- Contractor availability (assignments): ${appUrl}/contractor-availability?month=MONTH${deptId ? `&dept=${deptId}` : ""}
Replace MONTH with YYYY-MM (e.g. 2025-03).

When answering, if the user asks "who worked on X" or "who's scheduled for X", use the assignments data. If they ask about demand/requirements, use the requirements data.
When suggesting a page, output a link in this format: [LINK:Label|URL] e.g. [LINK:Open March schedule|${appUrl}/contractor-availability?month=2025-03]
Keep responses concise. Use English.`;

  return { context, departments, defaultDeptId };
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canAccess(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const departmentId = (body.department_id as string) || undefined;

    const lastUser = messages.filter((m: { role: string }) => m.role === "user").pop();
    const lastContent = typeof lastUser?.content === "string" ? lastUser.content.trim() : "";
    if (!lastContent) {
      return NextResponse.json({ error: "At least one user message is required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 503 });
    }

    const supabase = createAdminClient();
    const { context } = await fetchContext(supabase, departmentId);

    const client = new OpenAI({ apiKey });
    const systemMsg = {
      role: "system" as const,
      content: context,
    };

    const apiMessages = [systemMsg, ...messages.slice(-10)];

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: apiMessages,
      max_tokens: 800,
      temperature: 0.3,
    });

    let content = res.choices?.[0]?.message?.content ?? "No response.";
    const links: { label: string; url: string }[] = [];

    const linkRegex = /\[LINK:([^|]+)\|([^\]]+)\]/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push({ label: match[1].trim(), url: match[2].trim() });
    }
    content = content.replace(/\[LINK:[^|]+\|[^\]]+\]/g, "").replace(/\n{3,}/g, "\n\n").trim();

    return NextResponse.json({ content, links });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
