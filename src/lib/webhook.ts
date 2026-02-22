const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

export async function sendSlackNotification(text: string) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    console.error("Slack webhook failed");
  }
}

export async function sendTeamsNotification(text: string) {
  if (!TEAMS_WEBHOOK_URL) return;
  try {
    await fetch(TEAMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        summary: "Invoice Notification",
        text,
      }),
    });
  } catch {
    console.error("Teams webhook failed");
  }
}

export async function notifyWebhooks(message: string) {
  await Promise.allSettled([
    sendSlackNotification(message),
    sendTeamsNotification(message),
  ]);
}
