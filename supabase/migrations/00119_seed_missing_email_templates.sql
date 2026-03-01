-- Seed missing email templates (guest, availability, assignment, booking, office request, reminder).
-- 00112 already seeded: submission, manager_approved, manager_rejected, ready_for_payment, paid, manager_assigned, resubmitted, admin_approved.
INSERT INTO email_templates (template_key, subject_template, body_template, variables, updated_at) VALUES
  ('guest_link_sent', 'Thank you – {{programName}} – Invoice requested', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Dear {{guestName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Thank you for participating in <strong>{{programName}}</strong>. We truly appreciate your valuable contribution.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">As agreed, you will receive {{amount}} {{currency}} for your appearance.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Submit your invoice online:</strong> {{invoiceLink}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Payment is typically made within 10–14 working days after invoice approval.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">Best regards,<br/>{{producerName}}</p>', '["guestName","programName","amount","currency","invoiceLink","producerName"]'::jsonb, now()),

  ('guest_invoice_submitted', 'Invoice received – {{programName}} – {{invoiceNumber}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Dear {{guestName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Thank you for submitting your invoice for <strong>{{programName}}</strong>.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Invoice reference:</strong> {{invoiceNumber}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You can check the status of your invoice at any time: {{statusLink}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Payment is typically made within 10–14 working days after invoice approval.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">Best regards,<br/>{{producerName}}</p>', '["guestName","programName","invoiceNumber","statusLink","producerName"]'::jsonb, now()),

  ('guest_invitation_sent', 'Invitation – {{program}} – {{topic}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Dear {{guestName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You are invited to participate in <strong>{{program}}</strong>, which will focus on {{topic}}.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The recording will take place in our studio. The address is: {{studioAddress}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">If you have any questions, please contact your producer.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">Best regards,<br/>{{producerName}}</p>', '["guestName","program","topic","studioAddress","producerName"]'::jsonb, now()),

  ('availability_submitted', 'Contractor availability: {{personName}} — {{monthLabel}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A contractor has submitted their availability for role <strong>{{role}}</strong>.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Name:</strong> {{personName}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Month:</strong> {{monthLabel}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Available days:</strong> {{dates}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">Reply to this email to contact the contractor directly.</p>', '["personName","personEmail","role","monthLabel","dates"]'::jsonb, now()),

  ('availability_cleared', 'Availability cancelled — {{monthLabel}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your submitted availability for <strong>{{monthLabel}}</strong> has been cleared by an administrator.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">If you need to submit your availability again, please do so in My Availability.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["monthLabel","invoiceLink"]'::jsonb, now()),

  ('assignment_confirmed', 'Your schedule is confirmed — {{monthLabel}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi {{personName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your schedule for <strong>{{monthLabel}}</strong> has been confirmed. You are booked for the following days:</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">{{datesWithRole}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">If you have any questions, please contact London Operations.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["personName","monthLabel","datesWithRole","invoiceLink"]'::jsonb, now()),

  ('assignment_reminder', 'Reminder: You are booked tomorrow ({{role}}) — {{dateLabel}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi {{personName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">This is a reminder that you are booked for tomorrow, <strong>{{dateLabel}}</strong>, in the role of <strong>{{role}}</strong>.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">If you need to make any changes, please contact London Operations as soon as possible.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["personName","role","dateLabel","invoiceLink"]'::jsonb, now()),

  ('booking_form_approved', '{{name}} – {{month}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Dear Operations Team,</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The following freelancer booking form and payment details have been approved.</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Approved By:</strong> {{approverName}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6"><strong>Approval Date:</strong> {{approvalDateTime}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The approved Booking Form is attached.</p>
<p style="margin:0;font-size:12px;color:#94a3b8">Please file/record this approval in the relevant finance and compliance folder.</p>', '["name","month","approverName","approvalDateTime"]'::jsonb, now()),

  ('office_request_approved', 'Request approved: {{title}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been approved.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569">Assigned to: {{assigneeName}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","assigneeName","invoiceLink"]'::jsonb, now()),

  ('office_request_assigned', 'You have been assigned: {{title}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You have been assigned to this office request.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569">Due date: {{dueDate}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","dueDate","invoiceLink"]'::jsonb, now()),

  ('office_request_rejected', 'Request rejected: {{title}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been rejected.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<div style="margin:12px 0;padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#7f1d1d"><strong>Reason:</strong> {{reason}}</p></div>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","reason","invoiceLink"]'::jsonb, now()),

  ('office_request_new', 'New request: {{title}} — {{requesterName}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A new office request has been submitted and requires your attention.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569"><strong>Requester:</strong> {{requesterName}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569"><strong>Category:</strong> {{category}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569"><strong>Priority:</strong> {{priority}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","requesterName","category","priority","invoiceLink"]'::jsonb, now()),

  ('office_request_completed', 'Request completed: {{title}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been completed.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569">Completion notes: {{completionNotes}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","completionNotes","invoiceLink"]'::jsonb, now()),

  ('reminder_due', 'Reminder due: {{title}}', '<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A reminder is due today.</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">{{title}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569">{{description}}</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569"><strong>Due date:</strong> {{nextDueDate}}</p>
<p style="margin:0;font-size:12px;color:#94a3b8">View: {{invoiceLink}}</p>', '["title","description","nextDueDate","invoiceLink"]'::jsonb, now())
ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  variables = EXCLUDED.variables,
  updated_at = EXCLUDED.updated_at;
