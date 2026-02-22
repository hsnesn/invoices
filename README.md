# Invoice Approval Workflow

Production-ready internal invoice approval system with AI extraction, multi-stage workflow, and role-based access control.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend:** Next.js Route Handlers (server-side only for sensitive logic)
- **Database/Auth/Storage:** Supabase (Postgres, Auth, Storage, RLS)
- **Email:** Resend
- **AI Extraction:** OpenAI API (gpt-4o vision)
- **Hosting:** Vercel

## Prerequisites

- Node.js 18+
- Supabase account
- Resend account
- OpenAI API key

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose to client) |
| `OPENAI_API_KEY` | OpenAI API key for extraction |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender email (e.g. `Invoice System <noreply@yourdomain.com>`) |
| `NEXT_PUBLIC_APP_URL` | Full app URL (e.g. `https://your-app.vercel.app`) |

### 3. Supabase setup

1. **Run migrations** in order:

   ```bash
   supabase db push
   ```

   Or run the SQL files manually in the Supabase SQL Editor:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_rls_policies.sql`
   - `supabase/migrations/00003_storage_and_triggers.sql`

2. **Create storage bucket** in Supabase Dashboard:

   - Storage → New bucket → Name: `invoices`
   - Set to **Private**
   - Enable RLS if prompted

3. **Disable public signup** in Authentication → Providers → Email:
   - Turn off "Enable email signup"

4. **Create first admin user** (via Supabase Dashboard or SQL):

   - Create a user in Authentication → Users
   - Insert a profile with `role = 'admin'` and `is_active = true`:

   ```sql
   INSERT INTO profiles (id, full_name, role, is_active)
   VALUES ('<user-uuid-from-auth>', 'Admin', 'admin', true);
   ```

   - Send a magic link to that user to log in

### 4. Resend setup

- Verify your sending domain in Resend
- Use a verified domain for `RESEND_FROM_EMAIL`

### 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with magic link.

## Deployment (Vercel)

1. Push to GitHub and connect to Vercel
2. Add all environment variables in Vercel project settings
3. Deploy

## Roles and Access

| Role | Capabilities |
|------|--------------|
| **submitter** | Submit invoices, view own invoices only |
| **manager** | View assigned invoices, approve/reject, must confirm bank details before approval |
| **admin** | View all, manage users, departments, programs, set ready_for_payment |
| **finance** | View payment-stage invoices, mark paid, archive |

## Workflow Statuses

```
submitted → pending_manager → [approved_by_manager | rejected]
approved_by_manager → pending_admin → ready_for_payment → paid → archived
```

## Invite-only access

- Public signup is disabled
- Admins invite users via `/admin/users`
- Invited users receive a magic link; first login creates/updates their profile from the invitation

## Security

- Service role key is never exposed to the client
- All role checks are done server-side
- RLS enforces visibility rules on all tables
- Storage bucket is private; PDF access is via signed URLs only
- Deactivated users cannot log in

## Project structure

```
src/
├── app/
│   ├── (authenticated)/     # Protected routes
│   │   ├── submit/
│   │   ├── invoices/
│   │   └── admin/
│   ├── api/                 # Route handlers
│   │   ├── invite/
│   │   ├── invoices/        # upload, [id]/extract, [id]/pdf, [id]/status
│   │   ├── admin/           # departments, programs, users
│   │   └── ...
│   ├── login/
│   └── layout.tsx
├── components/
├── lib/
│   ├── supabase/            # client, server, admin
│   ├── auth.ts
│   ├── audit.ts
│   ├── email.ts
│   └── validation.ts
└── middleware.ts
```

## AI Extraction

Uses GPT-4o vision to extract: beneficiary_name, account_number, sort_code, invoice_number, invoice_date, net_amount, vat_amount, gross_amount, currency.

- UK sort codes are normalized (6 digits)
- Validation: net + vat ≈ gross (rounding tolerance)
- Manager must confirm bank details before approval

**Note:** OpenAI accepts PDF base64 directly. If extraction fails, ensure your PDF is not password-protected and the model has vision support.
