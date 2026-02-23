# Booking Form Email Workflow

Automated email workflow triggered when a Line Manager approves a freelancer invoice. Generates a Booking Form PDF, sends two emails with the PDF attached, and logs all activity with idempotency.

## Architecture

```
approval-trigger.ts     → Orchestrates: load data → check idempotency → generate PDF → send emails → audit
    ├── pdf-generator.ts   → Template-based PDF with exact field labels
    ├── email-sender.ts    → Email A (to approver) + Email B (to london.operations)
    └── audit-logger.ts   → Idempotency + audit table
```

## Data Model

### Booking Form Fields (exact labels in PDF)

| Field | Source |
|-------|--------|
| Name | `freelancer_invoice_fields.contractor_name` or `company_name` |
| Service Description | `freelancer_invoice_fields.service_description` |
| Amount | `days × rate + additional_cost` |
| Department | `departments.name` via `invoices.department_id` |
| Department 2 | `freelancer_invoice_fields.department_2` |
| Number of days | `freelancer_invoice_fields.service_days_count` |
| Month | `freelancer_invoice_fields.service_month` (+ year from approval date if missing) |
| Days | `freelancer_invoice_fields.service_days` |
| Service rate (per day) | `freelancer_invoice_fields.service_rate_per_day` |
| Additional Cost | `freelancer_invoice_fields.additional_cost` |
| Additional Cost Reason | `freelancer_invoice_fields.additional_cost_reason` |

### Audit Table: `booking_form_email_audit`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| invoice_id | uuid | FK invoices |
| approver_user_id | uuid | FK profiles |
| approved_at | timestamptz | Approval timestamp |
| idempotency_key | text | `{invoice_id}_{approved_at_iso}` — UNIQUE |
| email_a_sent_at | timestamptz | When Email A was sent |
| email_b_sent_at | timestamptz | When Email B was sent |
| status | text | `pending` \| `completed` \| `failed` |
| errors | text | Error details if failed |
| created_at | timestamptz | Record creation |

## Trigger Logic

**When:** Line Manager (or Admin acting as manager) approves a freelancer invoice  
**Transition:** `pending_manager` → `ready_for_payment`  
**Condition:** `invoice_type === 'freelancer'`

```typescript
// In status route - after workflow update
if (inv.invoice_type === "freelancer") {
  void triggerBookingFormWorkflow(supabase, {
    invoiceId,
    approverUserId: session.user.id,
    approverName,
    approverEmail,
    approvedAt: new Date(),
  });
}
```

## Idempotency

- **Key:** `{invoice_id}_{approved_at.toISOString()}`
- **Behaviour:** If an audit record exists with `status === 'completed'`, skip (return `{ ok: true, skipped: true }`)
- **Resend:** Uses `Idempotency-Key` header per email (`{key}_emailA`, `{key}_emailB`)

## Email A — To Approving Line Manager

- **Recipient:** Approver's email
- **Subject:** `{Name} – {Month} {Year}` (e.g. "John Smith – February 2026")
- **Body:** Confirmation, Booking Form details table, final acceptance notice, contact london.operations@trtworld.com
- **Attachment:** `BookingForm_{Name}_{Month}_{Year}.pdf`

## Email B — To London Operations

- **Recipient:** london.operations@trtworld.com
- **Subject:** Same as Email A
- **Body:** Approved by (name + email), approval date/time, Booking Form details, file/record request
- **Attachment:** Same PDF

## Migration

Run in Supabase SQL Editor:

```bash
# Or: supabase db push
```

File: `supabase/migrations/00013_booking_form_email_audit.sql`

## Example Test Cases

1. **Approval triggers once**
   - Manager approves freelancer invoice → PDF generated, Email A + B sent, audit `completed`
   - Same approval retried (e.g. network retry) → idempotency skips, no duplicate emails

2. **Retries**
   - First attempt: Email A sent, Email B fails → audit `failed`, `errors` populated
   - Retry with same `approved_at` → idempotency key exists but status not `completed` → could re-run (current: we only skip if `completed`; pending/failed will try to insert and hit unique constraint → "duplicate" → skip)

3. **Missing optional fields**
   - `department_2`, `additional_cost_reason` empty → rendered as "—" or ""
   - `service_month` without year → year from `approvedAt` appended

4. **Guest invoice**
   - Manager approves guest invoice → no workflow trigger (`invoice_type !== 'freelancer'`)

5. **Admin approves**
   - Admin approves freelancer as manager → workflow runs (admin block also triggers)

## File Structure

```
src/lib/booking-form/
  types.ts          # BookingFormData, ApprovalContext
  pdf-generator.ts  # generateBookingFormPdf(), sanitizeFilenamePart()
  email-sender.ts   # sendBookingFormEmailA(), sendBookingFormEmailB()
  audit-logger.ts   # buildIdempotencyKey, checkIdempotency, createAuditRecord, updateAuditRecord
  approval-trigger.ts # triggerBookingFormWorkflow()
```

## Environment

- `RESEND_API_KEY` — Required for email sending
- `RESEND_FROM_EMAIL` — From address (e.g. `Invoice System <noreply@example.com>`)
