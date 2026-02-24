/** Parse service_description (key: value lines) and return guest name for Guest invoices. */
export function parseGuestNameFromServiceDesc(desc: string | null | undefined): string | undefined {
  if (!desc?.trim()) return undefined;
  const meta: Record<string, string> = {};
  for (const line of desc.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep);
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
    const v = l.slice(idx + 1).trim();
    if (key) meta[key] = v;
  }
  for (const k of ["guest name", "guest", "guest_name"]) {
    const v = meta[k];
    if (v?.trim()) return v.trim();
  }
  return undefined;
}
