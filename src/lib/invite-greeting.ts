/**
 * Build greeting for invite emails.
 * - "dear": "Dear John Smith" (full name)
 * - "mr_ms": "Dear Mr./Ms. Smith" (surname only; falls back to full name if surname looks invalid)
 */
export type GreetingType = "dear" | "mr_ms";

export function buildInviteGreeting(guestName: string, greetingType: GreetingType = "dear"): string {
  const name = guestName.trim();
  if (!name) return "Dear Sir or Madam";

  const parts = name.split(/\s+/).filter(Boolean);
  if (greetingType === "dear") {
    return `Dear ${name}`;
  }
  // mr_ms: use surname only, but only if it looks like a name (contains letters)
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const hasLetters = /[a-zA-Z]/.test(lastName);
    if (hasLetters) {
      return `Dear Mr./Ms. ${lastName}`;
    }
  }
  return `Dear ${name}`;
}
