-- Email stages for My availability, booking, cancellation, assignment.
INSERT INTO email_stage_settings (stage_key, enabled) VALUES
  ('availability_submitted', true),
  ('availability_cleared', true),
  ('assignment_confirmed', true),
  ('assignment_reminder', true),
  ('booking_form_approved', true),
  ('office_request_approved', true),
  ('office_request_assigned', true),
  ('office_request_rejected', true)
ON CONFLICT (stage_key) DO NOTHING;

INSERT INTO email_recipient_settings (stage_key, recipient_type, enabled) VALUES
  ('availability_submitted', 'operations', true),
  ('availability_cleared', 'contractor', true),
  ('assignment_confirmed', 'contractor', true),
  ('assignment_confirmed', 'operations', true),
  ('assignment_reminder', 'contractor', true),
  ('booking_form_approved', 'line_manager', true),
  ('booking_form_approved', 'operations', true),
  ('office_request_approved', 'requester', true),
  ('office_request_assigned', 'assignee', true),
  ('office_request_rejected', 'requester', true)
ON CONFLICT (stage_key, recipient_type) DO NOTHING;
