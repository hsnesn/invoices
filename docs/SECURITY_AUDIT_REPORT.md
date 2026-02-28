# Security Audit Report – Invoice Management System

**Date:** February 27, 2025  
**Scope:** Full codebase review, aggressive mode  
**Stack:** Next.js, Supabase (PostgreSQL, Auth, Storage)

---

## 1. Architecture Security Analysis

### Where is security enforced?

- **Database layer:** RLS is enabled on all critical tables (`invoices`, `invoice_workflows`, `invoice_extracted_fields`, `audit_events`, etc.).
- **Application layer:** All API routes use `createAdminClient()` (service role key), which **bypasses RLS entirely**. Access control is implemented in application code (`requireAuth`, `requireAdmin`, `canAccessInvoice`).
- **Frontend:** Role-based UI hiding; no security enforcement.

### Why relying on frontend filters is dangerous

- Any API can be called directly (curl, Postman, browser console).
- Frontend checks only hide UI; they do not block requests.
- A malicious user can call `/api/invoices/[id]/status` with `to_status: "paid"` without using the UI.

### RLS bypass impact

- RLS policies are effectively unused for API traffic because the service role client bypasses them.
- If application logic has a bug or missing check, there is no database-level safeguard.
- Defense in depth is absent: a single bug in `canAccessInvoice` or `requireAuth` can expose data.

### Service role key exposure

- If `SUPABASE_SERVICE_ROLE_KEY` leaks (env, logs, repo, CI):
  - Full database read/write access.
  - Bypass of all RLS.
  - Storage access.
  - Ability to create/delete users via Auth API.
- **Mitigation:** Use anon key + RLS for user-facing operations where possible; reserve service role for server-only, trusted operations.

### Critical operations triggered from client

- Status changes (approve, reject, mark paid) are triggered by client POST to `/api/invoices/[id]/status` and `/api/invoices/bulk-status`.
- Role is taken from `profile.role` (profiles table), not JWT claims.
- If an attacker can change `profile.role` in the database (e.g. via SQL injection or compromised admin), they gain elevated privileges.

### Approval bypass scenarios

- **Scenario A:** Approver role is enforced in `status/route.ts` via `isAssigned`, `isDelegate`, `isAdmin`, `isOperations`, `isFinance`, `isOperationsRoom`. Logic is correct, but it lives only in application code.
- **Scenario B:** If `DEV_BYPASS_AUTH=true` is set in production, `requireAuth` returns a fake admin session. Anyone can act as admin without logging in.
- **Scenario C:** Operations role can call `/api/admin/setup/reset` and **delete all departments and programs**.

### Weakest architectural point

**All security depends on application code, with RLS bypassed.** A single bug or missing check in `canAccessInvoice`, `requireAuth`, or status transition logic can lead to data exposure or privilege escalation. The Operations role having access to a destructive reset endpoint is a serious design flaw.

---

## 2. Authorization and RLS Bypass Scenarios

### Can a user access another user’s invoice by guessing `invoice_id`?

- **With anon key:** No. RLS would block access.
- **With API (service role):** Yes, if `canAccessInvoice` is wrong or not called. Current implementation calls `canAccessInvoice` before returning data. UUIDs are hard to guess, but not impossible; enumeration is still a concern for high-value targets.

### Can a non-approver approve via direct API call?

- **No.** `status/route.ts` checks `isAssigned`, `isDelegate`, `isAdmin`, `isOperations`, `isFinance`, or `isOperationsRoom` before allowing status changes. A submitter calling `POST /api/invoices/[id]/status` with `to_status: "approved_by_manager"` receives 403.

### Can a non-finance user mark an invoice as paid?

- **No.** `isFinance` requires `profile.role === "finance"` and workflow status in `["ready_for_payment", "paid", "archived"]`. Finance-only transitions are enforced in code.

### JWT manipulation for role escalation?

- **No.** Role comes from `profiles` table via `requireAuth` → `getProfile`, not from JWT. Changing JWT claims does not change `profile.role`. Supabase signs JWTs; tampering would invalidate the token.

### RLS policy mistakes – what could leak?

- If RLS were used and misconfigured:
  - `can_see_invoice` bugs could expose invoices to wrong users.
  - `workflows_finance_update` allows finance to update only when status is already `ready_for_payment`, `paid`, or `archived`; a typo could broaden this.
- In practice, RLS is bypassed by the service role, so these policies are not in the active security path.

### Most likely authorization violation

**`DEV_BYPASS_AUTH=true` in production.** If this env var is set, `requireAuth` returns a hardcoded admin session. No login is required; anyone can access the app as admin. This is the highest-impact, lowest-effort failure mode.

---

## 3. Invoice Manipulation Risks

### Invoice number collision

- **Yes.** `invoice_extracted_fields.invoice_number` has **no UNIQUE constraint**.
- `next-invoice-number` API suggests the next number by scanning existing values; two concurrent requests can receive the same suggestion.
- No database-level uniqueness; duplicates are possible.

### Client-side invoice creation manipulation

- Invoice creation is server-side (upload, generate, import-excel APIs).
- Client can influence `invoice_number` via PATCH; server validates and applies changes.
- `invoice_number` can be updated in `invoices/[id]/route.ts` PATCH; role checks exist, but a bug could allow unauthorized edits.

### Post-approval data changes

- PATCH on `invoices/[id]` allows updates. Logic restricts who can change what, but there is no immutable “approved snapshot.”
- Extracted fields (amount, beneficiary, etc.) can be changed after approval if the caller passes access checks.

### Can “paid” be reverted?

- Status transitions are validated in `status/route.ts`. Reverting `paid` → `ready_for_payment` or earlier would require explicit transition logic.
- No explicit “revert paid” path was found, but the transition matrix should be audited for any back-edges.

### Double payment of the same invoice

- No idempotency key or “payment_id” linking to external payments.
- Logic prevents transitioning to `paid` twice only via status checks; there is no duplicate-payment guard at the payment system level.

### Race conditions

- **next-invoice-number:** Two users can get the same suggested number and create duplicate invoice numbers.
- **Bulk status:** Multiple concurrent bulk updates could interleave; no locking or optimistic concurrency.

### Most critical financial risk

**Duplicate invoice numbers with no UNIQUE constraint.** This can cause payment mix-ups, reconciliation errors, and audit issues. Add `UNIQUE(invoice_number)` (or a scoped unique index) and handle conflicts in the API.

---

## 4. Audit and Compliance Chain

### Is the audit log append-only?

- RLS: `REVOKE DELETE` and `REVOKE UPDATE` on `audit_events` for `authenticated`.
- **But:** All writes use `createAdminClient()`, which bypasses RLS. Service role can still DELETE/UPDATE `audit_events` if any code does so.
- No such code was found, but the database does not enforce append-only for service role.

### Can an admin delete audit logs?

- **Yes.** Any code using the admin client can delete or update `audit_events`. RLS does not apply to the service role.

### Can logs be updated?

- Same as above: service role can UPDATE. No technical barrier.

### Disputes (“I didn’t approve this”)

- Audit stores `actor_user_id`, `event_type`, `from_status`, `to_status`, `payload`.
- If logs can be altered or deleted, disputes cannot be resolved with confidence.
- No cryptographic signing or hash chain; integrity is not verifiable.

### Most dangerous audit scenario

**Admin or compromised service role deletes or alters audit records.** With no append-only enforcement at the DB level for the service role, the audit trail can be tampered with. In a dispute or investigation, the system cannot provide strong evidence.

---

## 5. File and Storage Security

### Are invoice PDFs public?

- **No.** The `invoices` bucket is private (per migration `00003_storage_and_triggers.sql`).
- PDFs are served via signed URLs from `/api/invoices/[id]/pdf`, which enforces `canAccessInvoice` before generating the URL.

### Signed URL lifetime

- 3600 seconds (1 hour). Reasonable for viewing; could be reduced for high-sensitivity documents.

### Storage path brute-force

- Paths follow patterns like `{user_id}/{invoice_id}-*.pdf`. UUIDs are not easily guessable, but:
  - If `invoice_id` is known (e.g. from another leak), paths are predictable.
  - Access is still gated by `canAccessInvoice` before URL generation.

### MIME validation

- Upload routes (`invoices/upload`, `freelancer-invoices/upload`) validate MIME types.
- Allowed types: PDF, images, Office documents. Reduces arbitrary executable uploads.

### Malicious file upload

- **XSS via Excel/Word preview:** Excel/Word files are converted to HTML with `XLSX.utils.sheet_to_html` and `mammoth.convertToHtml`, then rendered with `dangerouslySetInnerHTML`. A malicious Excel cell containing `<script>...</script>` could execute when previewed. **Stored XSS risk.**

### Most likely storage weakness

**Stored XSS via Office/Excel preview.** A user with upload rights can add a malicious Excel/Word file. When an approver or finance user previews it, script execution is possible. Sanitize or use a safe renderer (e.g. DOMPurify) before `dangerouslySetInnerHTML`.

---

## 6. Backup and Disaster Recovery

### Backup without restore testing

- Supabase provides automated backups. If restores are never tested, recovery may fail or be incomplete when needed.

### Backup encryption

- Supabase encrypts data at rest. Verify encryption and key management in your plan.

### Supabase outage recovery

- Depends on Supabase SLA and your runbook. Document expected RTO and test failover if applicable.

### Auth migration difficulty

- Supabase Auth is tightly integrated (sessions, JWTs, `auth.users`). Migrating to another auth provider requires:
  - User export/import
  - Session handling changes
  - Possible password reset for all users

### Most realistic disaster scenario

**Ransomware or accidental bulk delete.** If `admin/setup/reset` is misused or an admin account is compromised, departments and programs can be wiped. Without tested backups and a clear restore procedure, recovery could take days and involve data loss.

---

## 7. Software Security

### SQL injection

- **Low risk.** Supabase client uses parameterized queries. `search_invoices` RPC uses `plainto_tsquery`, which sanitizes input. No raw SQL concatenation found.

### XSS and data exfiltration

- **Risk:** `dangerouslySetInnerHTML` with HTML from Excel (`XLSX.utils.sheet_to_html`) and Word (`mammoth.convertToHtml`). Malicious content in uploaded files can execute in the browser.

### CSRF

- Next.js API routes are not automatically protected against CSRF. State-changing operations (POST/PATCH/DELETE) rely on:
  - Same-origin policy
  - Supabase session cookies (SameSite)
- A malicious site could trigger requests if the user is logged in and cookies are sent. Consider CSRF tokens for sensitive actions.

### API rate limiting

- `checkRateLimit` uses an **in-memory** `Map`. With serverless/multiple instances, each instance has its own store. Rate limiting is ineffective across instances.
- Comment in code: “For production with multiple instances, use Redis (e.g. @upstash/ratelimit).”

### Error messages and stack traces

- Several routes return `(e as Error).message` in JSON. In development, this can include stack traces or internal details. Ensure production error handling does not leak sensitive data.

### Easiest to exploit

**Stored XSS via Excel/Word preview.** No special access needed beyond upload rights. Upload a malicious file, wait for someone to preview it, and execute script in their session.

---

## 8. Internal Operational Risk

### Can an admin delete all invoices?

- No single “delete all invoices” endpoint found. Deletion is per-invoice. Admin could write a script or use DB access to delete in bulk.

### Approval chain override

- Admin and Operations have broad rights. Operations can call `admin/setup/reset` and delete all departments and programs. No approval or confirmation step.

### Finance paying wrong IBAN

- System does not validate IBAN or block payments. Finance can mark as paid regardless of beneficiary. Operational controls (e.g. approval, reconciliation) are outside the app.

### Role escalation

- Admin can change `profile.role` via `admin/users` API. No audit of role changes was found in the reviewed code. `user_invited` is logged, but not `role_updated`.

### Most likely internal abuse scenario

**Operations user resets departments/programs.** `requireAdminOrOperations` allows Operations to call `/api/admin/setup/reset`, which deletes all departments and programs. One click can break references and require manual recovery.

---

## 9. Vendor Lock-in and Migration

### Supabase dependencies

- **Auth:** Sessions, JWTs, `auth.users`, magic links, OAuth.
- **Database:** PostgreSQL with Supabase client, RPCs, triggers.
- **Storage:** Bucket policies, signed URLs, `storage.objects`.
- **Realtime:** If used, Supabase-specific subscriptions.

### Migration to another PostgreSQL

- Schema and data are standard PostgreSQL. Main work: replacing Supabase client calls with another driver (e.g. Prisma, Drizzle, raw pg).
- RPCs like `search_invoices` would need to be recreated.
- Triggers and functions are portable.

### Auth migration

- Most coupled component. Requires:
  - Exporting users and hashes (if supported)
  - New auth provider integration
  - Session and JWT handling changes
  - Possible full re-auth for users

### Storage migration

- Need to copy objects and update paths. Signed URLs and policies are Supabase-specific; new storage (S3, GCS, etc.) would need new access patterns.

### Hardest to migrate

**Supabase Auth.** Tight integration with `auth.users`, sessions, and profile loading makes it the main lock-in. Storage is second due to policies and URL generation.

---

## Final Assessment

### 1. Would this system pass a corporate audit?

**No, not in its current form.** Critical issues:

- `DEV_BYPASS_AUTH` can disable authentication.
- Operations can delete all departments and programs.
- Audit log is not cryptographically protected; service role can alter it.
- No UNIQUE constraint on invoice numbers.
- Stored XSS in file preview.
- In-memory rate limiting ineffective in production.
- Cron endpoints allow unauthenticated access when `CRON_SECRET` is unset.

### 2. Top 5 critical weaknesses

1. **`DEV_BYPASS_AUTH=true` in production** – Disables authentication; anyone can act as admin.
2. **Operations can reset departments/programs** – Single endpoint can wipe critical reference data.
3. **Stored XSS via Excel/Word preview** – Malicious files can execute script in viewers’ sessions.
4. **No UNIQUE constraint on invoice numbers** – Enables duplicates and financial/audit risk.
5. **Audit log not append-only for service role** – Logs can be altered or deleted; disputes cannot be reliably resolved.

### 3. If you were an attacker, where would you start?

1. **Check for `DEV_BYPASS_AUTH`** – If set in production, no further exploit is needed.
2. **Stored XSS** – Upload malicious Excel, get an approver to preview it, hijack session.
3. **Cron without `CRON_SECRET`** – Trigger cron jobs to send emails or change state.
4. **Operations account** – If obtainable, call `admin/setup/reset` to disrupt the system.
5. **Invoice ID enumeration** – If any API leaks invoice IDs or allows enumeration, combine with access checks to find gaps.

---

## Recommended Remediations (Priority Order)

1. **Remove or strictly guard `DEV_BYPASS_AUTH`** – Disable in production; use only in isolated dev environments.
2. **Restrict `admin/setup/reset`** – Require admin-only; add confirmation and possibly an extra secret.
3. **Sanitize HTML before `dangerouslySetInnerHTML`** – Use DOMPurify or similar for Excel/Word preview output.
4. **Add UNIQUE constraint on invoice numbers** – With migration and conflict handling.
5. **Enforce append-only audit at DB level** – Use triggers or a separate append-only store that service role cannot modify.
6. **Replace in-memory rate limiting** – Use Redis (e.g. Upstash) for production.
7. **Require `CRON_SECRET` for cron routes** – Reject requests when secret is missing.
8. **Audit role changes** – Log when `profile.role` is updated and by whom.
