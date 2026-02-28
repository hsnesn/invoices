-- Logos storage bucket (public for logo display across the app)
-- Also auto-created by API if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'logos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'logos',
      'logos',
      true,
      2097152,
      ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[]
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
