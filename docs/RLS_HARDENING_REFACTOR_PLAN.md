# RLS Hardening & Service Role Refactor Plan

**Date:** February 28, 2025  
**Scope:** Defense-in-depth by enforcing RLS for user-facing operations  
**Stack:** Next.js 14, Supabase (PostgreSQL, Auth, Storage)

---

## Executive Summary

This document provides a concrete, security-first refactor plan to move from service-role-only database access to a dual-client architecture: **user client** (anon key + RLS) for user-facing reads, and **admin client** (service role) only for system operations. The plan includes SQL policies, API refactor examples, multi-tenant preparation, and a phased migration.

---

## Part A: Refactor Strategy

### A.1 Dual-Client Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                            │
├─────────────────────────────────────────────────────────────────┤
│  User-Facing (reads, user-scoped writes)                         │
│  → createUserClient(session.access_token)                         │
│  → Uses anon key + JWT → RLS enforced                              │
├─────────────────────────────────────────────────────────────────┤
│  System Operations (audit, cron, cross-tenant, setup)             │
│  → createAdminClient()                                            │
│  → Uses service role → RLS bypassed (intentional)                │
└─────────────────────────────────────────────────────────────────┘
```

### A.2 User Client Implementation

Create `src/lib/supabase/user-client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env.server";

export type SupabaseUserClient = Awaited<ReturnType<typeof createUserClient>>;

/**
 * Creates a Supabase client that uses the user's JWT.
 * RLS policies are enforced; auth.uid() = the authenticated user.
 * Use for all user-facing read operations and user-scoped writes.
 */
export function createUserClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### A.3 Passing Session to API Routes

In every API route that needs user-scoped access:

```typescript
// Before (service role - bypasses RLS)
const supabase = createAdminClient();
const { data } = await supabase.from("invoices").select("*").eq("id", id).single();

// After (user client - RLS enforced)
const supabase = await createClient(); // from @/lib/supabase/server (reads cookies)
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const userClient = createUserClient(session.access_token);
const { data, error } = await userClient.from("invoices").select("*").eq("id", id).single();
if (error?.code === "PGRST116") return NextResponse.json({ error: "Not found" }, { status: 404 });
```

**Critical:** `createClient()` from `@/lib/supabase/server` reads cookies and returns the user's session. Use `session.access_token` for `createUserClient()`.

### A.4 Endpoint Classification

| Category | Use | Client | Examples |
|----------|-----|--------|----------|
| **User reads** | List/read invoices, profiles, departments, programs | `createUserClient` | `GET /api/invoices/search-full`, `GET /api/departments`, pages |
| **User writes** | Create invoice (as submitter), update own profile | `createUserClient` | `POST /api/invoices/upload`, `PATCH /api/profile` |
| **Status transitions** | Approve, reject, mark paid | Hybrid: userClient for read-check, adminClient for write + side effects | `POST /api/invoices/[id]/status` |
| **Audit insert** | Append audit event | `createAdminClient` | `createAuditEvent()` |
| **Cron jobs** | Pending reminders, digest emails | `createAdminClient` | `api/cron/*` |
| **Admin setup** | Reset departments, manage users | `createAdminClient` | `api/admin/setup/reset`, `api/admin/users` |
| **Invite accept** | Create profile from token | `createAdminClient` | `api/invite/accept` |
| **Background jobs** | AI extraction, salary extraction | `createAdminClient` | `invoice-extraction.ts`, `salary-extraction.ts` |

### A.5 Hybrid Pattern for Status/Complex Writes

For operations that need both RLS-check and service-role writes (e.g. status change + audit + email):

```typescript
// 1. Use userClient to verify access (RLS will block if no access)
const userClient = createUserClient(session.access_token);
const { data: inv, error: accessError } = await userClient
  .from("invoices")
  .select("id")
  .eq("id", invoiceId)
  .single();
if (accessError || !inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

// 2. Use adminClient for the actual write + side effects (audit, email)
const admin = createAdminClient();
await admin.from("invoice_workflows").update({ status: "approved_by_manager" }).eq("invoice_id", invoiceId);
await createAuditEvent(admin, { ... });
```

The read with userClient acts as the RLS gate; the write with adminClient is trusted because we've already verified access.

---

## Part B: RLS Policy Design

### B.1 Current Schema (No organization_id Yet)

- `invoices`: id, submitter_user_id, department_id, program_id, invoice_type, service_description, ...
- `invoice_workflows`: invoice_id, status, manager_user_id, ...
- `profiles`: id, role, department_id, program_ids, allowed_pages, full_name, is_active, ...
- `audit_events`: id, invoice_id, actor_user_id, event_type, ...

### B.2 Sync can_see_invoice with Application Logic

The application's `canAccessInvoice` includes: producer matching, operations_room_members, viewer + other_invoices. The DB function `can_see_invoice` must match.

**Migration: `00079_sync_can_see_invoice_with_app.sql`**

```sql
-- Sync can_see_invoice with application logic (invoice-access.ts)
-- Includes: operations_room, producer matching, viewer + other_invoices
CREATE OR REPLACE FUNCTION can_see_invoice(inv_id uuid, uid uuid)
RETURNS boolean AS $$
DECLARE
  p profiles;
  inv invoices;
  wf invoice_workflows;
  is_other boolean;
  or_member boolean;
  producer_match boolean;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = uid AND is_active = true;
  IF p IS NULL THEN RETURN false; END IF;

  SELECT * INTO inv FROM invoices WHERE id = inv_id;
  IF inv IS NULL THEN RETURN false; END IF;

  SELECT * INTO wf FROM invoice_workflows WHERE invoice_id = inv_id;

  -- Admin and operations see all
  IF p.role = 'admin' OR p.role = 'operations' THEN RETURN true; END IF;

  -- Viewer: see all except other_invoices unless allowed_pages includes it
  IF p.role = 'viewer' THEN
    is_other := (inv.invoice_type = 'other');
    IF is_other AND NOT (COALESCE(p.allowed_pages, ARRAY[]::text[]) @> ARRAY['other_invoices']) THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- Submitter sees own
  IF p.role = 'submitter' THEN
    RETURN inv.submitter_user_id = uid;
  END IF;

  -- Producer: see invoices where service_description contains "Producer: <full_name>"
  producer_match := (
    inv.service_description IS NOT NULL
    AND p.full_name IS NOT NULL
    AND LOWER(TRIM(SPLIT_PART(SPLIT_PART(inv.service_description, E'\n', 1), ':', 2))) = LOWER(TRIM(p.full_name))
  );
  IF producer_match THEN RETURN true; END IF;

  -- Manager sees assigned
  IF p.role = 'manager' THEN
    RETURN wf.manager_user_id = uid;
  END IF;

  -- Finance sees payment-stage
  IF p.role = 'finance' THEN
    RETURN wf.status IN ('ready_for_payment', 'paid', 'archived');
  END IF;

  -- Operations room members see all (for freelancer approval flow)
  SELECT EXISTS (SELECT 1 FROM operations_room_members WHERE user_id = uid) INTO or_member;
  IF or_member THEN RETURN true; END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

*Note: Producer matching above is simplified; the app uses `parseProducerFromServiceDesc`. You may need a more robust producer check or a dedicated column.*

### B.3 Audit Events: Append-Only via RLS

The trigger from 00077 blocks UPDATE/DELETE. For INSERT, we have two choices:

**Option A: Allow authenticated INSERT (current policy)**  
Users can insert audit_events if they have access to the invoice. The application uses adminClient for audit, so this policy is for direct DB access with user JWT.

**Option B: Only service role inserts audit (recommended)**  
Revoke INSERT from authenticated; only service role inserts. Then audit writes must use adminClient.

```sql
-- Restrict audit_events INSERT to service role only (no user client inserts)
REVOKE INSERT ON audit_events FROM authenticated;
-- Application uses createAuditEvent(adminClient, ...) - service role
```

**Recommendation:** Keep INSERT for authenticated with a strict WITH CHECK so that if we ever use userClient for audit, RLS still validates. The trigger already prevents UPDATE/DELETE.

```sql
-- Ensure audit INSERT policy is strict
DROP POLICY IF EXISTS "audit_insert" ON audit_events;
CREATE POLICY "audit_insert" ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (invoice_id IS NULL OR can_see_invoice(invoice_id, auth.uid()))
  );
```

### B.4 Multi-Tenant Preparation (Future: organization_id)

When adding multi-tenant support, add `organization_id` to:

- `profiles`
- `invoices` (and derived: workflows, extracted_fields, audit_events via invoice)
- `departments`, `programs` (or a shared org context)

**RLS for strict tenant isolation:**

```sql
-- Helper: same org as current user
CREATE OR REPLACE FUNCTION same_org_as_user(row_org_id uuid)
RETURNS boolean AS $$
  SELECT row_org_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true LIMIT 1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Example: invoices
CREATE POLICY "invoices_org_select" ON invoices FOR SELECT
  TO authenticated USING (same_org_as_user(organization_id) AND can_see_invoice(id, auth.uid()));
```

**Critical:** Every table with `organization_id` must have a policy that includes `same_org_as_user(organization_id)`. Even if the app forgets to filter by org, RLS blocks cross-tenant access.

---

## Part C: Multi-Tenant Isolation (Best Practices)

### C.1 Principle

**Users must never see data from other organizations, even if an endpoint forgets to filter by organization_id.**

### C.2 Policy Pattern

For every tenant-scoped table:

```sql
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  AND <role-specific logic>
)
```

### C.3 Migration Path for organization_id

1. Add `organization_id uuid REFERENCES organizations(id)` to profiles, invoices, departments, programs.
2. Backfill: single default org for existing rows.
3. Add RLS policies with `same_org_as_user`.
4. Update all application queries to include `organization_id` in filters (defense in depth).

---

## Part D: Service Role Usage Boundaries

### D.1 When Service Role Is Allowed

| Use Case | Reason |
|----------|--------|
| Audit event insert | Audit runs in trusted server context; trigger blocks modify |
| Cron jobs | No user session; system-level operations |
| Invite accept | Creates profile; no user session yet |
| Admin setup/reset | Destructive; admin-only, not user-scoped |
| Background extraction | AI/salary extraction; cross-invoice, system-level |
| User management | Admin creates/updates users; cross-tenant |
| MFA OTP | Writes to mfa_otp_codes; no RLS on that table |

### D.2 When Service Role Is NOT Allowed

| Use Case | Use Instead |
|----------|-------------|
| Listing invoices for current user | `createUserClient` |
| Reading a single invoice | `createUserClient` |
| Reading departments/programs | `createUserClient` |
| Reading profiles (for dropdowns) | `createUserClient` (admin sees all via RLS) |
| User creating an invoice | `createUserClient` |

### D.3 Enforcement: Naming and Lint Rules

1. **Naming convention:**  
   - `createUserClient` → variable name `userClient` or `userDb`  
   - `createAdminClient` → variable name `adminClient` or `adminDb`

2. **ESLint rule (optional):**  
   Disallow `createAdminClient` in files under `api/invoices/` except for:
   - Status route (hybrid)
   - Upload/generate (initial insert may need admin for storage path)
   - Explicit allowlist comment

3. **Code review checklist:**  
   - Does this route have a user session? → Use userClient for reads.
   - Is this a cron or background job? → AdminClient is OK.
   - Is this inserting audit? → AdminClient.

### D.4 File-Level Separation

```
src/lib/supabase/
  server.ts      # createClient() - reads cookies, anon key
  admin.ts       # createAdminClient() - service role
  user-client.ts # createUserClient(accessToken) - anon key + JWT
```

---

## Part E: Migration Plan

### Phase 1: Foundation (Week 1)

1. **Add `createUserClient`**  
   - Create `src/lib/supabase/user-client.ts`  
   - Add tests: RLS blocks when no access, allows when can_see_invoice

2. **Sync `can_see_invoice`**  
   - Migration 00079: update function to match `invoice-access.ts`  
   - Run in staging, verify no regressions

3. **Pick 2 low-risk read endpoints**  
   - `GET /api/departments`  
   - `GET /api/programs`  
   - Switch to userClient, deploy, verify

### Phase 2: Invoice Reads (Week 2)

4. **Switch invoice list endpoints**  
   - `(authenticated)/invoices/page.tsx` – Server Component: use userClient  
   - `GET /api/invoices/search-full` – use userClient  
   - `GET /api/invoices/search` – use userClient  

5. **Update `search_invoices` RPC**  
   - Change to `SECURITY INVOKER` so it runs as the caller and RLS applies  
   - Or: add `auth.uid()` filter inside the function to restrict results

```sql
-- Option: SECURITY INVOKER (RLS applies to underlying tables)
CREATE OR REPLACE FUNCTION search_invoices(search_query text)
RETURNS TABLE(invoice_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Run as caller; RLS on invoices applies
AS $$
  SELECT i.id AS invoice_id
  FROM invoices i
  LEFT JOIN invoice_extracted_fields e ON e.invoice_id = i.id
  WHERE i.invoice_type IN ('guest', 'salary')
    AND (search_query IS NULL OR search_query = '' OR (...))
  ORDER BY i.created_at DESC
  LIMIT 500;
$$;
```

### Phase 3: Invoice Detail & Files (Week 3)

6. **Switch invoice detail reads**  
   - `GET /api/invoices/[id]/files`  
   - `GET /api/invoices/[id]/download-files`  
   - `GET /api/invoices/[id]/pdf` (read metadata with userClient; signed URL generation can stay server-side)

7. **Switch other read-heavy endpoints**  
   - `GET /api/guest-contacts`  
   - `GET /api/dashboard/stats` (if user-scoped)

### Phase 4: Writes (Week 4+)

8. **Invoice upload**  
   - Use userClient for INSERT into invoices (submitter_user_id = auth.uid())  
   - Use adminClient for storage upload and workflow creation if needed

9. **Status route (hybrid)**  
   - Read-check with userClient  
   - Write + audit + email with adminClient

### Phase 5: Audit & Hardening

10. **Audit all remaining adminClient usage**  
    - Document each; ensure no user-facing reads use it

11. **Add organization_id (when ready)**  
    - Schema migration, backfill, RLS policies, app filters

---

## Part F: Risk Analysis

### F.1 What Could Break During Migration?

| Risk | Mitigation |
|------|------------|
| RLS too strict: user loses access | Sync `can_see_invoice` with app; test with each role |
| RLS too loose: user sees others' data | Test with two users; verify isolation |
| RPC `search_invoices` returns nothing | Use SECURITY INVOKER or add auth.uid() filter |
| Session expired mid-request | Handle 401; refresh token or redirect to login |
| Admin operations broken | Keep adminClient for setup, cron, invite, audit |

### F.2 Performance Implications

| Area | Impact |
|------|--------|
| RLS policy evaluation | Each row check runs `can_see_invoice` (SECURITY DEFINER). Add indexes on profiles(id), invoices(id), invoice_workflows(invoice_id). |
| JWT in header | No extra latency; token is small |
| Two clients per request | Minimal; only for hybrid routes |
| search_invoices RPC | If SECURITY INVOKER, RLS adds per-row checks. Consider materialized view or pre-filtered RPC for large datasets. |

### F.3 Testing RLS Correctness

1. **Unit tests (per role)**  
   - Create test users: submitter, manager, finance, admin, operations, viewer  
   - For each, call userClient.from("invoices").select()  
   - Assert visible set matches expected (e.g. submitter sees only own)

2. **Integration tests**  
   - Two users A and B; A creates invoice  
   - B (submitter) must not see A's invoice  
   - B (manager, not assigned) must not see A's invoice  
   - B (admin) must see A's invoice

3. **Staging verification**  
   - Log in as each role; verify invoice list and detail pages  
   - Try direct API calls with curl + session cookie

4. **RPC testing**  
   - Call search_invoices with userClient; verify results are filtered by RLS

---

## Part G: Concrete API Refactor Examples

### G.1 GET /api/departments (Simple Read)

**Before:**
```typescript
const supabase = createAdminClient();
const { data } = await supabase.from("departments").select("id,name");
return NextResponse.json(data ?? []);
```

**After:**
```typescript
const supabase = await createClient();
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const userClient = createUserClient(session.access_token);
const { data, error } = await userClient.from("departments").select("id,name");
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
return NextResponse.json(data ?? []);
```

### G.2 GET /api/invoices/search-full (Read with RPC)

**Before:**
```typescript
const supabase = createAdminClient();
const { data: idRows } = await supabase.rpc("search_invoices", { search_query: q });
// ... fetch invoices by id, then filter by canAccessInvoice
```

**After:**
```typescript
const supabase = await createClient();
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const userClient = createUserClient(session.access_token);
const { data: idRows } = await userClient.rpc("search_invoices", { search_query: q });
// RPC runs as user → RLS filters results
const ids = (idRows ?? []).map((r: { invoice_id: string }) => r.invoice_id).filter(Boolean);

const { data: invoices } = await userClient
  .from("invoices")
  .select("...")
  .in("id", ids)
  .in("invoice_type", ["guest", "salary"]);
// No canAccessInvoice loop needed - RLS already filtered
return NextResponse.json(invoices ?? []);
```

### G.3 POST /api/invoices/[id]/status (Hybrid)

**Before:** Full adminClient; canAccessInvoice in app code.

**After:**
```typescript
// 1. RLS gate: can user see this invoice?
const userClient = createUserClient(session.access_token);
const { data: inv, error: accessErr } = await userClient
  .from("invoices")
  .select("id, submitter_user_id, invoice_type, service_description")
  .eq("id", invoiceId)
  .single();
if (accessErr || !inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

// 2. App-level: can user perform this status transition? (role, workflow state)
const wf = await ...; // still need workflow - use admin for speed or userClient
// ... existing isAssigned, isDelegate, isAdmin, etc. checks ...

// 3. Write + side effects with admin
const admin = createAdminClient();
await admin.from("invoice_workflows").update({ ... }).eq("invoice_id", invoiceId);
await createAuditEvent(admin, { ... });
// send emails, etc.
```

---

## Summary

| Deliverable | Location |
|-------------|----------|
| User client | `src/lib/supabase/user-client.ts` |
| RLS sync | Migration `00079_sync_can_see_invoice_with_app.sql` |
| search_invoices | Migration to add SECURITY INVOKER |
| Endpoint refactors | Phased per Part E |
| Multi-tenant prep | Part B.4, Part C |
| Service role rules | Part D |

This plan provides defense-in-depth: even if application code omits an access check, RLS blocks unauthorized access. The migration is incremental and low-risk when done phase by phase with thorough testing.
