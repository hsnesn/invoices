/**
 * User-friendly error messages for consistent error handling.
 * Maps technical errors to clear, actionable messages.
 */

const ERROR_MAP: Record<string, string> = {
  "Failed to fetch": "Connection error. Please check your internet and try again.",
  "fetch": "Connection error. Please check your internet and try again.",
  "network": "Connection error. Please check your internet and try again.",
  "NetworkError": "Connection error. Please check your internet and try again.",
  "timeout": "Request timed out. Please try again.",
  "401": "Session expired. Please sign in again.",
  "403": "You don't have permission to perform this action.",
  "404": "The requested item was not found.",
  "429": "Too many requests. Please wait a moment and try again.",
  "500": "Something went wrong on our side. Please try again later.",
};

export function toUserFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    for (const [key, friendly] of Object.entries(ERROR_MAP)) {
      if (msg.toLowerCase().includes(key.toLowerCase())) return friendly;
    }
    if (msg.length < 100 && !msg.includes("at ") && !msg.includes("Error:")) {
      return msg;
    }
    return "Something went wrong. Please try again.";
  }
  if (typeof error === "string") return toUserFriendlyError(new Error(error));
  return "Something went wrong. Please try again.";
}

export function getApiErrorMessage(data: { error?: string } | null): string {
  const raw = data?.error?.trim();
  if (!raw) return "Operation failed. Please try again.";
  if (raw.length < 80 && !raw.includes("at ")) return raw;
  return toUserFriendlyError(new Error(raw));
}
