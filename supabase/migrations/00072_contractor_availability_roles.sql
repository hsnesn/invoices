-- Contractor Availability: add role to availability, seed roles in freelancer_setup_items

ALTER TABLE output_schedule_availability
  ADD COLUMN IF NOT EXISTS role text;

COMMENT ON COLUMN output_schedule_availability.role IS 'Role for this availability (from contractor_availability_role setup)';

-- Seed default roles (category = contractor_availability_role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM freelancer_setup_items WHERE category = 'contractor_availability_role') THEN
    INSERT INTO freelancer_setup_items (category, value, sort_order) VALUES
      ('contractor_availability_role', 'Output', 1),
      ('contractor_availability_role', 'Camera', 2),
      ('contractor_availability_role', 'Audio', 3),
      ('contractor_availability_role', 'Editorial', 4);
  END IF;
END $$;
