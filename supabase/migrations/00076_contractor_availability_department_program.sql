-- Add department and program to contractor availability (demand/supply)
-- Department is required for news; programs filter within department.

-- 1. output_schedule_availability
ALTER TABLE output_schedule_availability
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

-- Backfill: use first department as default for existing rows
DO $$
DECLARE
  default_dept_id uuid;
BEGIN
  SELECT id INTO default_dept_id FROM departments ORDER BY name LIMIT 1;
  IF default_dept_id IS NOT NULL THEN
    UPDATE output_schedule_availability SET department_id = default_dept_id WHERE department_id IS NULL;
  END IF;
END $$;

-- Drop old unique, add new (user_id, date, department_id, program_id)
ALTER TABLE output_schedule_availability DROP CONSTRAINT IF EXISTS output_schedule_availability_user_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_output_avail_user_date_dept_prog
  ON output_schedule_availability (user_id, date, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(program_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_output_avail_department ON output_schedule_availability(department_id);
CREATE INDEX IF NOT EXISTS idx_output_avail_program ON output_schedule_availability(program_id);

-- 2. contractor_availability_requirements
ALTER TABLE contractor_availability_requirements
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

DO $$
DECLARE
  default_dept_id uuid;
BEGIN
  SELECT id INTO default_dept_id FROM departments ORDER BY name LIMIT 1;
  IF default_dept_id IS NOT NULL THEN
    UPDATE contractor_availability_requirements SET department_id = default_dept_id WHERE department_id IS NULL;
  END IF;
END $$;

ALTER TABLE contractor_availability_requirements DROP CONSTRAINT IF EXISTS contractor_availability_requirements_date_role_key;
DROP INDEX IF EXISTS idx_car_date_role_dept_prog;
DROP INDEX IF EXISTS contractor_availability_requirements_date_role_dept_prog_key;
CREATE UNIQUE INDEX contractor_availability_requirements_date_role_dept_prog_key
  ON contractor_availability_requirements (date, role, department_id, program_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_car_department ON contractor_availability_requirements(department_id);
CREATE INDEX IF NOT EXISTS idx_car_program ON contractor_availability_requirements(program_id);

-- 3. contractor_availability_recurring
ALTER TABLE contractor_availability_recurring
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

DO $$
DECLARE
  default_dept_id uuid;
BEGIN
  SELECT id INTO default_dept_id FROM departments ORDER BY name LIMIT 1;
  IF default_dept_id IS NOT NULL THEN
    UPDATE contractor_availability_recurring SET department_id = default_dept_id WHERE department_id IS NULL;
  END IF;
END $$;

ALTER TABLE contractor_availability_recurring DROP CONSTRAINT IF EXISTS contractor_availability_recurring_day_of_week_role_key;
DROP INDEX IF EXISTS idx_car_recurring_dow_role_dept_prog;
CREATE UNIQUE INDEX contractor_availability_recurring_dow_role_dept_prog_key
  ON contractor_availability_recurring (day_of_week, role, department_id, program_id) NULLS NOT DISTINCT;

-- 4. output_schedule_assignments
ALTER TABLE output_schedule_assignments
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

DO $$
DECLARE
  default_dept_id uuid;
BEGIN
  SELECT id INTO default_dept_id FROM departments ORDER BY name LIMIT 1;
  IF default_dept_id IS NOT NULL THEN
    UPDATE output_schedule_assignments SET department_id = default_dept_id WHERE department_id IS NULL;
  END IF;
END $$;

ALTER TABLE output_schedule_assignments DROP CONSTRAINT IF EXISTS output_schedule_assignments_user_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_output_assign_user_date_dept_prog
  ON output_schedule_assignments (user_id, date, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(program_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_output_assign_department ON output_schedule_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_output_assign_program ON output_schedule_assignments(program_id);
