# Roles and Permissions

This document lists all user roles and their access rights: what they can see, what they can do, and what is restricted.

---

## Role Overview

| Role | Description |
|------|--------------|
| **admin** | Full access: all pages, all actions, user management, setup |
| **operations** | Sees all invoices; can approve freelancer invoices in Operations Room; salaries access |
| **finance** | Payment-stage invoices only; can mark paid; salaries access |
| **manager** | Assigned invoices or in-scope (department/program); approve/reject at manager stage |
| **viewer** | Read-only: guest invoices, freelancer invoices, reports (no Salaries, Setup, User Management) |
| **submitter** | Own invoices only; submit new invoices |

---

## Pages and Access

### Dashboard (`/dashboard`)

| Role | Can Access |
|------|------------|
| admin | Full dashboard, all page cards |
| operations | Guest Invoices, Contractor Invoices, Salaries, Reports |
| finance | Guest Invoices, Contractor Invoices, Salaries, Reports |
| manager | All pages (unless restricted by `allowed_pages`) |
| viewer | Guest Invoices, Contractor Invoices, Reports only |
| submitter | All pages (unless restricted by `allowed_pages`) |

**Note:** If a user has `allowed_pages` set (non-null array), they only see those pages. `NULL` means default for the role.

---

### Guest Invoices (`/invoices`)

| Role | Can See | Can Do |
|------|---------|--------|
| admin | All invoices | Approve, reject, mark paid, edit, replace file, bulk download, assign line manager |
| operations | All invoices | View, download PDF |
| finance | Only `ready_for_payment`, `paid`, `archived` | Mark paid, view, replace file (on payment-stage invoices) |
| manager | Assigned or in-scope (department/program) | Approve/reject at manager stage, replace file, add notes |
| viewer | All invoices | View only (read-only) |
| submitter | Own invoices only | Submit, resubmit if rejected, replace file on own |

---

### Contractor Invoices (`/freelancer-invoices`)

| Role | Can See | Can Do |
|------|---------|--------|
| admin | All invoices | Approve, reject, mark paid, edit, replace file, bulk download, send booking form emails |
| operations | All invoices | Approve/reject at `pending_admin` (Operations Room) only if member of `operations_room_members` |
| finance | Only `ready_for_payment`, `paid`, `archived` | Mark paid |
| manager | Assigned (department manager) or in-scope | Approve/reject at manager stage, replace file |
| viewer | All invoices | View only |
| submitter | Own invoices only | Submit, resubmit if rejected, replace file on own |

---

### Salaries (`/salaries`)

| Role | Can Access | Can Do |
|------|------------|--------|
| admin | Yes | Full: edit, mark paid, delete, upload |
| operations | Yes | Full: edit, mark paid, delete, upload |
| finance | Yes | Mark paid only (no edit, no delete, no upload) |
| manager | No | Redirected to dashboard |
| viewer | No | Redirected to dashboard |
| submitter | No | Redirected to dashboard |

---

### Setup (`/admin/setup`)

| Role | Can Access |
|------|------------|
| admin | Yes |
| All others | No (redirected to dashboard) |

**Setup includes:** Departments, Programmes, Contractor setup items, Email templates, Contractor templates.

**Example:** Ünal Şahin (or any non-admin user) cannot open Setup because it is **admin-only**.

---

### Reports (`/admin/reports`)

| Role | Can Access |
|------|------------|
| admin | Yes |
| viewer | Yes |
| operations | Yes |
| finance | Yes (via allowed_pages) |
| manager | Yes (if `allowed_pages` includes `reports`) |
| submitter | Yes (if `allowed_pages` includes `reports`) |

---

### User Management (`/admin/users`)

| Role | Can Access |
|------|------------|
| admin | Yes |
| All others | No (API returns 403) |

**User Management includes:** Invite users, change roles, activate/deactivate, set department, program_ids, allowed_pages.

---

## API / Feature Permissions by Role

### Invoice PDF
- **admin, operations:** All invoices
- **manager:** Assigned or in-scope
- **finance:** Payment-stage only
- **submitter:** Own only

### Invoice Status Changes
- **admin:** Can force all transitions (approve, reject, mark paid, archive, etc.)
- **operations:** Can approve/reject freelancer invoices at `pending_admin` (Operations Room)
- **finance:** Can mark paid only on payment-stage invoices
- **manager:** Can approve/reject at manager stage (assigned invoices)
- **submitter:** Can resubmit if rejected

### Replace file / Add file
- **admin, manager:** Can replace on any invoice they can see
- **submitter:** Own invoices only

### Bulk download
- **admin:** Can bulk download all invoices

### Email templates
- **admin:** Can read/write email templates

### Booking form trigger
- **admin:** Can trigger booking form emails

### Employees
- **admin, operations:** Can list, create, update, delete employees

### Salaries
- **admin, operations:** Upload, edit, delete, mark paid
- **finance:** Mark paid only

---

## Summary Table: Who Can See What

| Page / Feature | admin | operations | finance | manager | viewer | submitter |
|----------------|-------|------------|---------|---------|--------|-----------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Guest Invoices | ✓ all | ✓ all | ✓ payment-stage | ✓ assigned | ✓ all (read) | ✓ own |
| Contractor Invoices | ✓ all | ✓ all | ✓ payment-stage | ✓ assigned | ✓ all (read) | ✓ own |
| Salaries | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Setup | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Reports | ✓ | ✓ | ✓ | ✓* | ✓ | ✓* |
| User Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Submit Invoice | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* If `allowed_pages` includes `reports`) or default for role

---

## `allowed_pages` Override

For users with `allowed_pages` set (non-null array), the dashboard only shows pages in that list. For example:

- `allowed_pages: ["guest_invoices", "freelancer_invoices", "reports"]` → User sees only those three cards
- `allowed_pages: null` → Default role-based visibility applies

**Admin-only pages** (Setup, User Management) are never shown to non-admins regardless of `allowed_pages`.

---

## Quick Reference: Why Can't Ünal Şahin Open Setup?

**Setup** (`/admin/setup`) is restricted to **admin** role only. If Ünal Şahin has role `manager`, `finance`, `viewer`, `operations`, or `submitter`, he will be redirected to `/dashboard` when trying to access `/admin/setup`.

**To grant Setup access:** Change user role to `admin` in User Management (admin only).
