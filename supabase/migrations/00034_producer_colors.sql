-- Producer colors: admin-assignable hex colors for producer badges in invoice lists.
CREATE TABLE IF NOT EXISTS producer_colors (
  producer_name text PRIMARY KEY,
  color_hex text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE producer_colors IS 'User-assignable hex colors for producer badges (e.g. #3A626A). Fallback: hash-based color.';
