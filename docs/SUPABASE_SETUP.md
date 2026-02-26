# Supabase Setup Checklist

## 1. Environment Variables (required)

Add these to `.env.local` (local) and Vercel project settings (production):

| Variable | Where to get it | Required |
|----------|-----------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role (secret) | Yes |

---

## 2. Database Migrations

Run all migrations so the schema is up to date:

```bash
supabase db push
```

Or manually in **Supabase Dashboard → SQL Editor**: run each file in `supabase/migrations/` in order (00001, 00002, … 00036).

---

## 3. Storage Bucket

**Supabase Dashboard → Storage → New bucket**

- **Name:** `invoices` (exact name required)
- **Public:** Off (Private)
- RLS is handled by the app via signed URLs

---

## 4. Authentication

**Supabase Dashboard → Authentication → Providers → Email**

- Turn **off** "Enable email signup" (invite-only access)

---

## 5. First Admin User

1. **Authentication → Users → Add user** (email + password)
2. Copy the user UUID
3. **SQL Editor** → run:

```sql
INSERT INTO profiles (id, full_name, role, is_active)
VALUES ('<paste-user-uuid>', 'Admin', 'admin', true);
```

4. Send a magic link to that user to log in

---

## 6. Optional: Vercel Cron

If using the booking-form cron (`vercel.json`):

- Add `CRON_SECRET` in Vercel env vars (random string)
- Vercel Cron will send `Authorization: Bearer <CRON_SECRET>` automatically
- If not set, the cron endpoint allows unauthenticated calls (less secure)

---

## Quick Checklist

- [ ] Supabase URL, anon key, service role key in env
- [ ] `supabase db push` (or migrations run manually)
- [ ] Storage bucket `invoices` created (private)
- [ ] Email signup disabled
- [ ] First admin user created and profile inserted
