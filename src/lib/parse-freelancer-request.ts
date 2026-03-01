/**
 * Parse natural language freelancer request into structured data.
 * Shared by bulk-request API and chat.
 */
import OpenAI from "openai";

export type ParsedFreelancerRequest = {
  month: string;
  role: string;
  count_per_day: number;
  days_of_week: number[];
};

export async function parseFreelancerRequest(
  text: string,
  availableRoles: string[]
): Promise<ParsedFreelancerRequest | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
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
