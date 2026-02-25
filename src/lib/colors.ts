/**
 * Brand color palette - use for department/program badges and status sections.
 * All badges use white text (text-white).
 */
export const PALETTE = {
  roundtable: "#3A626A",
  straitTalk: "#1F8C48",
  nexus: "#18C868",
  lightBlue: "#65A0F8",
  biggerThanFive: "#E53A4C",
  beyondBorders: "#1B81A3",
  theNewsmakers: "#8C5FD8",
  lightGray: "#C2C2C2",
  trtWorldNews: "#28C16E",
  programmes: "#F9509E",
  trtHaber: "#E72B4D",
  trtArabi: "#0C86BB",
  digital: "#8D56CE",
  default: "#C4C4C4",
} as const;

const ORDERED_COLORS = [
  PALETTE.trtWorldNews,
  PALETTE.programmes,
  PALETTE.trtHaber,
  PALETTE.trtArabi,
  PALETTE.digital,
  PALETTE.roundtable,
  PALETTE.straitTalk,
  PALETTE.nexus,
  PALETTE.lightBlue,
  PALETTE.biggerThanFive,
  PALETTE.beyondBorders,
  PALETTE.theNewsmakers,
  PALETTE.lightGray,
  PALETTE.default,
];

export function departmentBadgeStyle(name: string): { backgroundColor: string; color: string } {
  const v = (name || "").toLowerCase();
  let hex: string = PALETTE.default;
  if (v.includes("world") && v.includes("news")) hex = PALETTE.trtWorldNews;
  else if (v.includes("programme")) hex = PALETTE.programmes;
  else if (v.includes("haber") || v.includes("news")) hex = PALETTE.trtHaber;
  else if (v.includes("arabi")) hex = PALETTE.trtArabi;
  else if (v.includes("digital")) hex = PALETTE.digital;
  else if (v.includes("roundtable")) hex = PALETTE.roundtable;
  else if (v.includes("strait")) hex = PALETTE.straitTalk;
  else if (v.includes("nexus")) hex = PALETTE.nexus;
  else if (v.includes("bigger")) hex = PALETTE.biggerThanFive;
  else if (v.includes("beyond")) hex = PALETTE.beyondBorders;
  else if (v.includes("newsmaker")) hex = PALETTE.theNewsmakers;
  else {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hex = ORDERED_COLORS[Math.abs(hash) % ORDERED_COLORS.length];
  }
  return { backgroundColor: hex, color: "#ffffff" };
}

export function programmeBadgeStyle(value: string): { backgroundColor: string; color: string } {
  return departmentBadgeStyle(value);
}

export const STATUS_GROUP_COLORS: Record<string, string> = {
  submitted: PALETTE.nexus,
  rejected: PALETTE.biggerThanFive,
  admin_approvals: PALETTE.programmes,
  ready_for_payment: PALETTE.trtArabi,
  paid: PALETTE.trtWorldNews,
};

function statusToGroup(status: string): string {
  if (status === "rejected") return "rejected";
  if (status === "submitted" || status === "pending_manager") return "submitted";
  if (status === "approved_by_manager" || status === "pending_admin") return "admin_approvals";
  if (status === "ready_for_payment") return "ready_for_payment";
  if (status === "paid" || status === "archived") return "paid";
  return "submitted";
}

export function statusBadgeStyle(status: string): { backgroundColor: string; color: string } {
  const group = statusToGroup(status);
  const hex = STATUS_GROUP_COLORS[group] ?? PALETTE.default;
  return { backgroundColor: hex, color: "#ffffff" };
}

/** Guest invoice section headers (InvoicesBoard) */
export const GUEST_SECTION_COLORS: Record<string, string> = {
  pending_line_manager: PALETTE.nexus,
  rejected: PALETTE.biggerThanFive,
  ready_for_payment: PALETTE.trtArabi,
  paid_invoices: PALETTE.trtWorldNews,
  no_payment_needed: PALETTE.default,
};

export function sectionHeaderStyle(group: string): { backgroundColor: string; color: string } {
  const hex = GUEST_SECTION_COLORS[group] ?? PALETTE.default;
  return { backgroundColor: hex, color: "#ffffff" };
}
