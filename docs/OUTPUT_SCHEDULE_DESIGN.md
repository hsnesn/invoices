# Output Schedule – Design Document

## Overview

A separate page for managing output shift scheduling: freelancers submit availability, AI assigns shifts fairly, emails are sent automatically, and attendance is tracked via door log import or manual matching.

---

## Features

### 1. Availability Form
- Freelancers select which days they are available in the next month
- Stored per user per date
- Month selector (e.g. March 2026)

### 2. AI Scheduling
- Admin sets: people needed per day (e.g. 3)
- AI assigns who works which days:
  - Not more than needed, not less
  - Fair distribution (minimize variance in shifts per person)
  - Only from users who marked themselves available
- Output: assignments per person per date

### 3. Booking Emails
- After AI assigns: automatic email to each assigned person
- Content: "We would like to book you for these days: [dates]. Please confirm or contact us."
- Uses existing Resend/email infra

### 4. Weekly Report
- Setup: select recipients (user IDs) for weekly aggregated list
- Weekly email with full schedule for the week
- Sent to configured recipients

### 5. Attendance Tracking
- List of assigned days per person with status: pending / attended / no_show
- **Import**: Door entry/exit file (CSV/Excel) – columns: date, time, person identifier (name/badge)
- **Match**: Auto-match by name/badge to profiles; or manual match
- **Manual match**: Configurable who can do it (e.g. admin, operations, or selected users)

---

## Database Schema

### `output_schedule_availability`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| date | date | Available date |
| created_at | timestamptz | |
| UNIQUE(user_id, date) | | |

### `output_schedule_settings` (or app_settings)
- `output_schedule_people_per_day`: int (default 3)
- `output_schedule_weekly_report_recipients`: uuid[] (user IDs)
- `output_schedule_manual_match_allowed`: uuid[] or role[] (who can manual match)

### `output_schedule_assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK profiles |
| date | date | Assigned date |
| status | enum | pending, confirmed, attended, no_show |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE(user_id, date) | | |

### `output_schedule_door_log`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| date | date | Log date |
| time | time? | Entry/exit time |
| raw_identifier | text | Name or badge from file |
| matched_user_id | uuid? | FK profiles, set by import or manual |
| source | text | 'import' | 'manual' |
| created_at | timestamptz | |

---

## Pages & Access

| Page | Path | Who |
|------|------|-----|
| Output Schedule | /output-schedule | admin, operations, + allowed_pages |
| Availability form | (same page, tab) | All authenticated (submit own) |
| Admin: AI assign, emails, import | (same page, admin tab) | admin, operations |
| Manual attendance match | (same page) | admin, operations, or configured users |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/output-schedule/availability | My availability (or all for admin) |
| POST | /api/output-schedule/availability | Submit/update my availability |
| GET | /api/output-schedule/assignments | List assignments (filter by user/date) |
| POST | /api/output-schedule/ai-assign | Run AI assignment (admin) |
| POST | /api/output-schedule/send-booking-emails | Send booking emails (admin) |
| POST | /api/output-schedule/send-weekly-report | Send weekly report (admin) |
| GET | /api/output-schedule/settings | Get settings |
| PATCH | /api/output-schedule/settings | Update settings (admin) |
| POST | /api/output-schedule/import-door-log | Import door log file (admin) |
| PATCH | /api/output-schedule/attendance | Manual attendance match |

---

## Implementation Phases

1. **Phase 1**: DB migrations, availability form, basic page
2. **Phase 2**: AI scheduling, booking emails
3. **Phase 3**: Weekly report, door log import
4. **Phase 4**: Attendance manual match, permissions
