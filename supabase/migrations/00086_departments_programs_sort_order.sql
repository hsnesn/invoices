-- Add sort_order to departments and programs for configurable list ordering in settings.

ALTER TABLE departments ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Backfill: assign sort_order by current name order for existing rows
WITH dept_ordered AS (
  SELECT id, row_number() OVER (ORDER BY name) - 1 AS rn
  FROM departments
)
UPDATE departments d SET sort_order = dept_ordered.rn
FROM dept_ordered WHERE d.id = dept_ordered.id;

WITH prog_ordered AS (
  SELECT id, row_number() OVER (ORDER BY department_id, name) - 1 AS rn
  FROM programs
)
UPDATE programs p SET sort_order = prog_ordered.rn
FROM prog_ordered WHERE p.id = prog_ordered.id;

COMMENT ON COLUMN departments.sort_order IS 'Display order in dropdowns; lower = first. Configurable in Admin Setup.';
COMMENT ON COLUMN programs.sort_order IS 'Display order within department; lower = first. Configurable in Admin Setup.';
