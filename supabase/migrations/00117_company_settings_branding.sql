-- Seed new company settings for booking form, ICS, and guest invoice PDF.
INSERT INTO app_settings (key, value) VALUES
  ('booking_form_title', '"TRT WORLD LONDON — FREELANCE SERVICES BOOKING FORM"'::jsonb),
  ('booking_form_footer', '"This booking form confirms the scope of services, delivery dates and fees as agreed between the Client and the Service Provider under the contract for services."'::jsonb),
  ('ics_prodid', '"-//TRT World//Guest Invitation//EN"'::jsonb),
  ('ics_summary_prefix', '"TRT World:"'::jsonb),
  ('ics_description_broadcast', '"Broadcast on TRT World"'::jsonb),
  ('invoice_pdf_payee_address', '"TRT WORLD UK\n200 Grays Inn Road\nHolborn, London\nWC1X 8XZ"'::jsonb)
ON CONFLICT (key) DO NOTHING;
