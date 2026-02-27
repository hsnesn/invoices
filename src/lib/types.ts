export type AppRole = "submitter" | "manager" | "admin" | "finance" | "viewer" | "operations";

export type InvoiceStatus =
  | "submitted"
  | "pending_manager"
  | "rejected"
  | "approved_by_manager"
  | "pending_admin"
  | "ready_for_payment"
  | "paid"
  | "archived";

export const ALL_PAGES = [
  { key: "guest_invoices", label: "Guest Invoices" },
  { key: "submit_invoice", label: "Submit Invoice" },
  { key: "freelancer_invoices", label: "Contractor Invoices" },
  { key: "other_invoices", label: "Other Invoices" },
  { key: "salaries", label: "Salaries" },
  { key: "setup", label: "Setup" },
  { key: "reports", label: "Reports" },
  { key: "guest_contacts", label: "Guest Contacts" },
  { key: "messages", label: "Messages" },
  { key: "user_management", label: "User Management" },
] as const;

export type PageKey = (typeof ALL_PAGES)[number]["key"];

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  role: AppRole;
  department_id: string | null;
  program_ids: string[] | null;
  allowed_pages: PageKey[] | null;
  is_active: boolean;
  receive_invoice_emails?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface Program {
  id: string;
  department_id: string;
  name: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  submitter_user_id: string;
  department_id: string | null;
  program_id: string | null;
  service_description: string | null;
  service_date_from: string | null;
  service_date_to: string | null;
  currency: string;
  storage_path: string | null;
  previous_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWorkflow {
  id: string;
  invoice_id: string;
  status: InvoiceStatus;
  manager_user_id: string | null;
  rejection_reason: string | null;
  payment_reference: string | null;
  paid_date: string | null;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceExtractedFields {
  id: string;
  invoice_id: string;
  beneficiary_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  extracted_currency: string | null;
  needs_review: boolean;
  manager_confirmed: boolean;
  raw_json: Record<string, unknown> | null;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  invoice_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  department_id: string | null;
  program_ids: string[] | null;
  invited_by: string;
  invited_at: string;
  accepted: boolean;
  accepted_at: string | null;
}
