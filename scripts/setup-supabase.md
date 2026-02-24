# Supabase Kurulum Adımları

## 1. Migration'ları çalıştır

Supabase Dashboard → SQL Editor → New query

Sırayla çalıştır:
1. `supabase/migrations/00001_initial_schema.sql`
2. `supabase/migrations/00002_rls_policies.sql`
3. `supabase/migrations/00003_storage_and_triggers.sql`
...
18. `supabase/migrations/00018_invite_token_expiry.sql`
19. `supabase/migrations/00019_email_settings_and_templates.sql` (e-posta taslakları, aşama ayarları, kullanıcı tercihi)

## 2. Storage bucket oluştur

Storage → New bucket
- Name: `invoices`
- Public: **Kapalı** (Private)

## 3. Public signup'ı kapat

Authentication → Providers → Email
- "Enable email signup" → **Kapalı**

## 4. İlk admin kullanıcıyı oluştur

Authentication → Users → Add user
- Email ve şifre gir

SQL Editor'da çalıştır (user ID'yi auth.users'dan al):
```sql
INSERT INTO profiles (id, full_name, role, is_active)
VALUES ('<user-uuid>', 'Admin', 'admin', true);
```
