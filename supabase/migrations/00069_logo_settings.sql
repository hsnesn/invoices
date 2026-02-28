-- Logo settings: store paths/URLs for different logo scenarios
-- Values can be filenames like trt-logo.png (public folder) or full URLs (e.g. Supabase Storage)
insert into app_settings (key, value) values
  ('logo_trt', '"trt-logo.png"'::jsonb),
  ('logo_trt_world', '"trt-world-logo.png"'::jsonb),
  ('logo_email', '"logo.png"'::jsonb)
on conflict (key) do nothing;
