/**
 * Parse natural language freelancer request into structured data.
 * Shared by bulk-request API and chat.
 * Uses fast regex fallback for common patterns to avoid slow OpenAI calls.
 */
import OpenAI from "openai";

export type ParsedFreelancerRequest = {
  month: string;
  role: string;
  count_per_day: number;
  days_of_week: number[];
};

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Fast fallback for common patterns like "5 output every weekday" - no AI call. */
function trySimpleParse(text: string, availableRoles: string[]): ParsedFreelancerRequest | null {
  const t = text.toLowerCase().trim();
  // Only use simple parse when recurrence is clear (avoids false positives)
  if (!/\b(every|weekday|week\s*day|mon-?fri|monday-?friday|weekend|everyday|each\s+day)\b/i.test(t)) {
    return null;
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Match month: "in March", "for March"
  let monthNum = currentMonth;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (t.includes(MONTH_NAMES[i])) {
      monthNum = i + 1;
      break;
    }
  }

  // Match count: "5 output", "I need 5 outputs", "4 output every"
  const countMatch = t.match(/(?:need|want|require|i\s+)?(\d+)\s*(?:outputs?|output)/i) ?? t.match(/(\d+)\s*(?:outputs?|output)/i);
  if (!countMatch) return null;
  const count = Math.max(1, Math.min(20, parseInt(countMatch[1], 10)));

  // Match days: weekday = Mon–Fri, weekend = Sat–Sun, every day = all
  let days_of_week = [1, 2, 3, 4, 5];
  if (/\b(weekend|saturday|sunday)\b/i.test(t) && !/\bweekday\b/i.test(t)) {
    days_of_week = [0, 6];
  } else if (/\b(every\s+day|everyday|all\s+days)\b/i.test(t)) {
    days_of_week = [0, 1, 2, 3, 4, 5, 6];
  }

  // Match role: prefer "Output" for output/outputs
  let role = "Output";
  if (/\b(output|outputs)\b/i.test(t)) {
    role = availableRoles.find((r) => r.toLowerCase() === "output") ?? availableRoles[0] ?? "Output";
  } else {
    for (const r of availableRoles) {
      if (new RegExp(`\\b${r.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) {
        role = r;
        break;
      }
    }
  }

  const month = `${currentYear}-${String(monthNum).padStart(2, "0")}`;
  return { month, role, count_per_day: count, days_of_week };
}

export async function parseFreelancerRequest(
  text: string,
  availableRoles: string[]
): Promise<ParsedFreelancerRequest | null> {
  // Fast path: try simple regex for common patterns (no AI, no network)
  const simple = trySimpleParse(text, availableRoles);
  if (simple) return simple;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey, timeout: 15000 });
  const rolesList = availableRoles.length > 0 ? availableRoles.join(", ") : "Output, Director, Camera, Output Producer, etc.";
  const currentYear = new Date().getFullYear();

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You parse freelancer/contractor request text into structured JSON. 
Output ONLY valid JSON, no markdown. 
- month: YYYY-MM (e.g. ${currentYear}-03 for March ${currentYear}). If no year given, use ${currentYear}.
- role: one of [${rolesList}] or closest match. "output", "outputs", "output producer" = "Output" or "Output Producer".
- count_per_day: integer 1-20
- days_of_week: array of 0-6 (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat). "weekdays"/"week days"/"Mon-Fri" = [1,2,3,4,5], "weekends" = [0,6], "every day"/"everyday" = [0,1,2,3,4,5,6]`,
      },
      {
        role: "user",
        content: `Parse this request: "${text}"`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = res.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const month = String(parsed.month ?? "").trim();
    const role = String(parsed.role ?? "Output").trim();
    const count_per_day = Math.max(1, Math.min(20, Math.floor(Number(parsed.count_per_day) || 1)));
    let days_of_week = Array.isArray(parsed.days_of_week)
      ? (parsed.days_of_week as number[]).filter((d) => d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];

    if (days_of_week.length === 0) days_of_week = [1, 2, 3, 4, 5];

    if (!/^\d{4}-\d{2}$/.test(month)) return null;

    return { month, role, count_per_day, days_of_week };
  } catch {
    return null;
  }
}
