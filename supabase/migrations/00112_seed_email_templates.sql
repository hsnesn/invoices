-- Seed default email templates with placeholder-based content.
-- Admins can edit these in Setup → Email Templates. Empty = use built-in default.
INSERT INTO email_templates (template_key, subject_template, body_template, variables, updated_at) VALUES
  ('submission', '{{invoiceNumber}} — Submitted for review', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A new invoice has been submitted and is waiting for review.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">View the invoice: {{invoiceLink}}</p>', '["invoiceNumber","guestName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('manager_approved', '{{invoiceNumber}} — Approved by {{managerName}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Great news! The invoice has been approved by <strong>{{managerName}}</strong> and is now pending review.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">View: {{invoiceLink}}</p>', '["invoiceNumber","guestName","managerName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('manager_rejected', '{{invoiceNumber}} — Rejected', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your invoice has been rejected.</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<div style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#7f1d1d"><strong>Rejection Reason:</strong> {{reason}}</p></div>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155">You can make corrections and resubmit. View: {{invoiceLink}}</p>', '["invoiceNumber","guestName","managerName","reason","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('ready_for_payment', '{{invoiceNumber}} — Ready for payment', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been fully approved and is now ready for payment processing.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Process payment: {{invoiceLink}}</p>', '["invoiceNumber","guestName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('paid', '{{invoiceNumber}} — Payment completed', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been paid successfully.</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">View: {{invoiceLink}}</p>', '["invoiceNumber","guestName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('manager_assigned', '{{invoiceNumber}} — Assigned to you for review', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You have been assigned to review this invoice.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Review: {{invoiceLink}}</p>', '["invoiceNumber","guestName","managerName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('resubmitted', '{{invoiceNumber}} — Resubmitted after correction', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A previously rejected invoice has been corrected and resubmitted for your review.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Review: {{invoiceLink}}</p>', '["invoiceNumber","guestName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now()),

  ('admin_approved', '{{invoiceNumber}} — Admin approved, ready for payment', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been approved by admin and is now ready for payment.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 16px;font-size:14px;color:#334155">Status: {{status}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Process payment: {{invoiceLink}}</p>', '["invoiceNumber","guestName","invoiceLink","status","companyOrPerson","monthYear"]'::jsonb, now())
ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  variables = EXCLUDED.variables,
  updated_at = EXCLUDED.updated_at;
