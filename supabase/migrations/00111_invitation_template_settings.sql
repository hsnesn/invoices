-- Invitation template settings for Setup → Company & contacts.
INSERT INTO app_settings (key, value) VALUES
  ('invitation_subject_prefix', '"TRT World – Invitation to the program:"'::jsonb),
  ('invitation_body_intro', '"I am writing to invite you to participate in <strong>{program}</strong>, which will be broadcast on {channel} and will focus on {topic}."'::jsonb),
  ('invitation_broadcast_channel', '"TRT World"'::jsonb),
  ('invitation_studio_intro', '"The recording will take place in our studio. The address is:"'::jsonb)
ON CONFLICT (key) DO NOTHING;
