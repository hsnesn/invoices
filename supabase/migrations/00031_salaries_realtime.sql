-- Enable Realtime for salaries table (payments, status changes, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'salaries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE salaries;
  END IF;
END $$;
