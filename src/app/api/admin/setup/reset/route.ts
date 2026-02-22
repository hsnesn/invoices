import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const DEFAULT_DEPARTMENTS = [
  "Programmes",
  "TRT World News",
  "TRT Haber",
  "TRT Arabi",
  "Digital",
];

const DEFAULT_PROGRAMS: [string, string][] = [
  ["Programmes", "Roundtable"],
  ["Programmes", "Nexus"],
  ["Programmes", "The Newsmakers"],
  ["Programmes", "Strait Talk"],
  ["Programmes", "Bigger Than Five"],
  ["Programmes", "Beyond Borders"],
  ["TRT World News", "World News Bulletin"],
  ["TRT World News", "Global Briefing"],
  ["TRT Haber", "Gunun Ozeti"],
  ["TRT Haber", "Aksam Bulteni"],
  ["TRT Arabi", "Al Youm"],
  ["TRT Arabi", "Moubasher"],
  ["Digital", "YouTube Special"],
  ["Digital", "Social Media Clip"],
];

export async function POST() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { error: errProg } = await supabase.from("programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (errProg) throw errProg;
    const { error: errDept } = await supabase.from("departments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (errDept) throw errDept;

    for (const name of DEFAULT_DEPARTMENTS) {
      await supabase.from("departments").insert({ name });
    }

    const { data: newDepts } = await supabase
      .from("departments")
      .select("id, name");
    const nameToId = new Map((newDepts ?? []).map((d) => [d.name, d.id]));

    for (const [deptName, progName] of DEFAULT_PROGRAMS) {
      const deptId = nameToId.get(deptName);
      if (deptId) {
        await supabase.from("programs").insert({ department_id: deptId, name: progName });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
