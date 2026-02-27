export type InvoiceRow = {
  id: string;
  storage_path?: string | null;
  submitter_user_id: string;
  service_description: string | null;
  currency: string;
  created_at: string;
  service_date_from: string | null;
  service_date_to: string | null;
  department_id: string | null;
  program_id: string | null;
  previous_invoice_id: string | null;
  invoice_workflows: {
    status: string;
    rejection_reason: string | null;
    manager_user_id: string | null;
    paid_date: string | null;
  }[] | null;
  invoice_files?: { storage_path: string; file_name: string; sort_order: number }[] | null;
  invoice_extracted_fields: {
    invoice_number: string | null;
    beneficiary_name: string | null;
    account_number: string | null;
    sort_code: string | null;
    gross_amount: number | null;
    extracted_currency: string | null;
    raw_json?: Record<string, unknown> | null;
    needs_review?: boolean;
  }[] | null;
};

export type DisplayRow = {
  id: string;
  submitterId: string;
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  department: string;
  departmentId: string;
  programme: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  amountNum: number | null;
  anomalyFlags: string[];
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  lineManager: string;
  lineManagerId: string;
  paymentDate: string;
  status: string;
  rejectionReason: string;
  createdAt: string;
  group: "pending_line_manager" | "ready_for_payment" | "paid_invoices" | "no_payment_needed" | "rejected";
  hasMissingInfo: boolean;
  missingFields: string[];
  files: { storage_path: string; file_name: string }[];
};

export type TimelineEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown> | null;
  actor_name: string;
  created_at: string;
};

export type NoteItem = {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
};

export type SavedFilter = {
  name: string;
  filters: {
    search: string;
    departmentFilter: string;
    programmeFilter: string;
    groupFilter: string;
    missingInfoFilter: boolean;
    producerFilter: string;
    paymentTypeFilter: string;
    managerFilter: string;
    dateFrom: string;
    dateTo: string;
    sortField: string;
    sortDir: string;
  };
};

export type EditDraft = {
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  departmentId: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  lineManagerId: string;
};
