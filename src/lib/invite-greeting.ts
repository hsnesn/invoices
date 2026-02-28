/**
 * Build greeting for invite emails.
 * - "dear": "Dear John Smith" (full name)
 * - "mr_ms": "Dear Mr./Ms. Smith" (surname only)
 * - "mr" | "ms" | "mrs" | "miss": "Dear Mr/Ms/Mrs/Miss Smith" (surname only)
 */
export type GreetingType = "dear" | "mr_ms" | "mr" | "ms" | "mrs" | "miss";

const TITLE_MAP: Record<Exclude<GreetingType, "dear">, string> = {
  mr_ms: "Mr./Ms.",
  mr: "Mr",
  ms: "Ms",
  mrs: "Mrs",
  miss: "Miss",
};

export function buildInviteGreeting(guestName: string, greetingType: GreetingType = "dear"): string {
  const name = guestName.trim();
  if (!name) return "Dear Sir or Madam";

  const parts = name.split(/\s+/).filter(Boolean);
  if (greetingType === "dear") {
    return `Dear ${name}`;
  }
  const title = TITLE_MAP[greetingType];
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const hasLetters = /[a-zA-Z]/.test(lastName);
    if (hasLetters) {
      return `Dear ${title} ${lastName}`;
    }
  }
  return `Dear ${name}`;
}
