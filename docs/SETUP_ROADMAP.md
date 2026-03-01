# Setup Roadmap — Minimizing Code Changes

Aim: Move configurable values into Setup so admins can change them without code deployments.

---

## Done (Already in Setup)

| Item | Location |
|------|----------|
| Company name, address | Setup → Company & contacts |
| Signature name | Setup → Company & contacts |
| Studio address | Setup → Company & contacts |
| App name | Setup → Company & contacts |
| Operations email | Setup → Company & contacts |
| Finance email | Setup → Company & contacts |
| Bank transfer form recipient | Setup → Company & contacts |
| Bank accounts (GBP, EUR, USD) | Setup → Company & contacts |

---

## Phase 1 — High impact, low effort

### 1.1 Wire existing settings

| Setting | Used by | Change needed |
|---------|---------|---------------|
| `studio_address` | InvitedGuestsClient, GuestContactsClient default value | Read from company settings API on load; use as default |
| `email_operations` | contractor-availability, office-requests, weekly-digest, booking-form | Replace hardcoded `london.operations@trtworld.com` with `getCompanySettingsAsync().email_operations` |
| `email_finance` | salaries/[id] fallback, ADMIN_LOCKOUT_EMAIL fallback | Use company settings fallback |

### 1.2 Invitation text templates

**Add to Setup → Company & contacts (new section: Invitations)**

| Key | Current | Purpose |
|-----|---------|---------|
| `invitation_subject_prefix` | "TRT World – Invitation to the program:" | Email subject base |
| `invitation_body_intro` | "I am writing to invite you to participate in {program}, which will be broadcast on TRT World and will focus on {topic}." | Body text; placeholders: {program}, {topic} |
| `invitation_broadcast_channel` | "TRT World" | Used in "broadcast on {channel}" |
| `invitation_studio_intro` | "The recording will take place in our studio. The address is:" | Studio format text |

**Files:** invite-send, bulk-invite-send, bulk-email, InvitedGuestsClient, GuestContactsClient

---

## Phase 2 — Medium effort

### 2.1 Guest invoice PDF address

**Add:** `invoice_pdf_payee_address` (multi-line) or reuse `company_address` + `company_name`

| File | Current |
|------|---------|
| guest-invoice-pdf.ts | TO_ADDRESS = ["TRT WORLD UK", "200 Grays Inn Road", ...] |

Store as JSON array or newline-separated text in app_settings.

### 2.2 Booking form branding

**Add to Setup → Company & contacts**

| Key | Current | File |
|-----|---------|------|
| `booking_form_title` | "TRT WORLD LONDON — FREELANCE SERVICES BOOKING FORM" | booking-form/pdf-generator.ts |
| `booking_form_footer` | "TRT World UK" | booking-form/pdf-generator.ts |
| `booking_form_operations_label` | "TRT World London Operations" | booking-form/email-sender.ts |
| `booking_form_system_label` | "TRT World London" | booking-form/email-sender.ts |

### 2.3 ICS / calendar invitations

**Add to Setup**

| Key | Current | File |
|-----|---------|------|
| `ics_prodid` | "TRT World" | ics-generator.ts |
| `ics_summary_prefix` | "TRT World:" | ics-generator.ts |
| `ics_description_broadcast` | "Broadcast on TRT World" | ics-generator.ts |

### 2.4 Program descriptions

**Add to Setup → Guest Invoices (new subsection: Program descriptions)**

- Program name → short description
- Stored in `app_settings` as JSON: `{"Roundtable": "...", "Nexus": "..."}`
- Fallback: `program-descriptions.ts` (or seed from it)

**File:** program-descriptions.ts → `getProgramDescription()` reads from DB first

---

## Phase 3 — Larger scope

### 3.1 Layout metadata (SEO, titles)

**Add to Setup → Branding**

| Key | Current | Used in |
|-----|---------|---------|
| `site_title` | "TRT UK Operations Platform" | app/layout.tsx metadata |
| `site_description` | "Finance, operations and workflow management for TRT World UK" | app/layout.tsx metadata |

Requires server component to fetch settings for metadata (or API + generateMetadata).

### 3.2 Help page copy

**Add to Setup → Help content**

- Editable FAQ / help sections stored in app_settings
- Help page reads from API instead of static JSX

### 3.3 Invoice extraction prompts

**Add to Setup → AI extraction (advanced)**

- Custom extraction prompts (beneficiary, email, etc.)
- High risk; keep as optional advanced feature

### 3.4 Guest invoice link expiry

**Add to Setup → Guest Invoices**

| Key | Current | Purpose |
|-----|---------|---------|
| `guest_invoice_link_expiry_days` | 7 | Token validity |
| `guest_invoice_reminder_days` | e.g. 3 days before expiry | Cron reminder timing |

---

## Phase 4 — Environment variables (cannot move to Setup easily)

These stay in `.env` / Vercel:

| Variable | Reason |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Build-time / runtime base URL |
| `NEXT_PUBLIC_APP_NAME` | Could be overridden by Setup `app_name` for display |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Secrets, infrastructure |
| `SUPABASE_*` | Infrastructure |
| `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` | Secrets |
| `CRON_SECRET` | Security |

**Option:** Use `app_name` from Setup for user-facing text; keep `NEXT_PUBLIC_APP_NAME` as fallback or for metadata when DB is unavailable.

---

## Suggested implementation order

1. **Phase 1.1** — Wire `studio_address`, `email_operations`, `email_finance` everywhere they are hardcoded
2. **Phase 1.2** — Invitation templates (subject, body, channel)
3. **Phase 2.1** — Guest invoice PDF address from company settings
4. **Phase 2.2** — Booking form branding
5. **Phase 2.4** — Program descriptions (DB-backed)
6. **Phase 2.3** — ICS branding
7. **Phase 3** — As needed

---

## Storage pattern

- Use existing `app_settings` table (key, value jsonb)
- New keys: `invitation_subject_prefix`, `invitation_body_intro`, etc.
- API: extend `/api/admin/company-settings` or add `/api/admin/invitation-settings`, `/api/admin/branding-settings` for logical grouping
