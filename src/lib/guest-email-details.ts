import type { GuestEmailDetails } from "@/lib/email";

function parseServiceDesc(desc: string | null | undefined): Record<string, string> {
  if (!desc?.trim()) return {};
  const out: Record<string, string> = {};
  for (const line of desc.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep);
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
    const val = l.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function fromAliases(meta: Record<string, string>, aliases: string[]): string {
  for (const key of aliases) {
    const v = meta[key];
    if (v?.trim()) return v.trim();
  }
  return "—";
}

type ExtFields = {
  invoice_number: string | null;
  gross_amount: number | null;
};

/** Build GuestEmailDetails for email subject and body. */
export function buildGuestEmailDetails(
  serviceDescription: string | null | undefined,
  departmentName: string,
  programmeName: string,
  ext: ExtFields | null
): GuestEmailDetails {
  const meta = parseServiceDesc(serviceDescription);
  const guest = fromAliases(meta, ["guest name", "guest", "guest_name"]);
  const producer = fromAliases(meta, ["producer", "producer name", "prod"]);
  const title = fromAliases(meta, ["title", "programme title", "program title"]);
  const topic = fromAliases(meta, ["topic", "description", "service description"]);
  const tx1 = fromAliases(meta, ["tx date", "tx date 1", "1. tx date"]);
  const tx2 = fromAliases(meta, ["2. tx date", "tx date 2"]);
  const tx3 = fromAliases(meta, ["3. tx date", "tx date 3"]);
  const txParts = [tx1, tx2, tx3].filter((v) => v && v !== "—");
  const txDate = txParts.length > 0 ? txParts.join(", ") : "—";

  const invNo = (ext?.invoice_number ?? "").trim() || "—";
  const gross = ext?.gross_amount;
  const amount =
    gross != null && Number.isFinite(gross)
      ? `£${gross.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  return {
    producer,
    guest,
    title,
    department: departmentName || "—",
    programme: programmeName || "—",
    topic,
    txDate,
    invoiceNumber: invNo,
    amount,
  };
}
