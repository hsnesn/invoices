# 2FA (Two-Factor Authentication) Implementation Guide

This guide explains how to add TOTP-based 2FA to your invoice app using Supabase Auth. **No code is implemented**—this is a step-by-step plan.

---

## Overview

Supabase Auth supports MFA via **TOTP** (Time-based One-Time Password). Users scan a QR code with an authenticator app (Google Authenticator, Authy, 1Password, Apple Keychain) and enter a 6-digit code during login.

**AAL (Authenticator Assurance Level):**
- `aal1`: User logged in with first factor only (magic link, password)
- `aal2`: User also verified with second factor (TOTP)

---

## Step 1: Enable MFA in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. MFA (TOTP) is **enabled by default** on all projects—no extra config needed.

---

## Step 2: Enrollment Flow (User Sets Up 2FA)

Add a **Settings** or **Profile** page where users can enable 2FA.

### 2.1 Call `mfa.enroll()`

When the user clicks "Enable 2FA":

```ts
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
});
```

- `data.id` = factor ID (save for later)
- `data.totp.qr_code` = SVG QR code (display as `<img src={data.totp.qr_code} />`)
- `data.totp.secret` = fallback if user can’t scan (show as plain text)

### 2.2 User Scans QR Code

User scans with their authenticator app.

### 2.3 Verify Setup

User enters the 6-digit code from the app. You call:

```ts
const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });
const verify = await supabase.auth.mfa.verify({
  factorId: data.id,
  challengeId: challenge.data.id,
  code: userEnteredCode,
});
```

If `verify` succeeds, 2FA is active for that user.

---

## Step 3: Challenge Step at Login

After the user signs in (magic link, password, etc.), check if MFA is required:

```ts
const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
```

| currentLevel | nextLevel | Meaning |
|--------------|-----------|---------|
| `aal1` | `aal1` | No MFA enrolled |
| `aal1` | `aal2` | MFA enrolled but not verified this session |
| `aal2` | `aal2` | MFA verified |
| `aal2` | `aal1` | MFA disabled (stale session) |

If `nextLevel === 'aal2'` and `currentLevel !== nextLevel`, show the MFA challenge screen.

### 3.1 MFA Challenge Screen

1. Call `supabase.auth.mfa.listFactors()` to get the user’s TOTP factor
2. Call `supabase.auth.mfa.challenge({ factorId })` to create a challenge
3. User enters the 6-digit code
4. Call `supabase.auth.mfa.verify({ factorId, challengeId, code })`
5. On success, the session is refreshed and the user can access the app

---

## Step 4: Where to Integrate in Your App

### 4.1 Enrollment

- **Profile / Settings page**: Add a "Security" or "Two-Factor Authentication" section
- Optional: Prompt new users to enable 2FA right after first login

### 4.2 Challenge

- **Auth callback** (`/auth/callback`): After `supabase.auth.getSession()`, call `getAuthenticatorAssuranceLevel()`
- If MFA is required, redirect to `/auth/mfa-verify` (or show an MFA modal)
- After successful verify, redirect to the main app

### 4.3 Middleware

- In `middleware.ts`, after confirming the user is logged in, you can optionally check `aal` in the JWT
- The `aal` claim is in the access token: `session.user.app_metadata?.aal`

---

## Step 5: Unenrollment (Optional)

Allow users to disable 2FA:

```ts
await supabase.auth.mfa.unenroll({ factorId });
```

---

## Step 6: Enforce MFA (Optional)

To require 2FA for all users (e.g. admins):

1. Check `getAuthenticatorAssuranceLevel()` after login
2. If `nextLevel === 'aal2'` and user hasn’t verified, block access until they complete MFA
3. You can store a "MFA required" flag in `profiles` or `app_settings` to control who must use 2FA

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/app/(authenticated)/settings/page.tsx` or profile | New "Enable 2FA" section with enroll + verify flow |
| `src/app/auth/mfa-verify/page.tsx` | New page for MFA challenge (code input) |
| `src/app/auth/callback/route.ts` | After login, check AAL; if `aal2` needed, redirect to `/auth/mfa-verify` |
| `src/middleware.ts` | Optionally check AAL for protected routes |
| `src/lib/supabase/client.ts` | Use browser client for `mfa.*` calls (not server) |

---

## Important Notes

1. **Client-side only**: `supabase.auth.mfa.*` must run in the browser (client component), not in Route Handlers.
2. **Session refresh**: After successful `mfa.verify()`, Supabase refreshes the session automatically.
3. **Magic links**: Your app uses magic links; the flow is: user clicks link → lands on callback → callback checks AAL → if MFA needed, redirect to MFA page.
4. **Backup codes**: Supabase does not provide backup codes; consider adding your own (e.g. generate 10 one-time codes, hash and store, show once to user).

---

## References

- [Supabase MFA (TOTP) Docs](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase MFA API Reference](https://supabase.com/docs/reference/javascript/auth-mfa-api)
