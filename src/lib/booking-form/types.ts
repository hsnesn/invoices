/**
 * Booking Form data model - fields must match PDF labels exactly.
 * Sourced from freelancer_invoice_fields, invoice_extracted_fields, departments.
 */
export type BookingFormData = {
  name: string;
  serviceDescription: string;
  amount: number;
  department: string;
  department2: string;
  numberOfDays: number;
  month: string;
  days: string;
  serviceRatePerDay: number;
  additionalCost: number;
  additionalCostReason: string;
  approverName: string;
  bookedBy: string;
  approvalDate: string;
};

export type ApprovalContext = {
  invoiceId: string;
  approverUserId: string;
  approverName: string;
  approverEmail: string;
  approvedAt: Date;
};
