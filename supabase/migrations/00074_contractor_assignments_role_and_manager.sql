-- Add role to assignments for contractor availability (per-role scheduling)
ALTER TABLE output_schedule_assignments
  ADD COLUMN IF NOT EXISTS role text;

COMMENT ON COLUMN output_schedule_assignments.role IS 'Role for this assignment (from contractor_availability_role setup)';

-- Extend assignment policies to include manager
DROP POLICY IF EXISTS "output_assign_select" ON output_schedule_assignments;
CREATE POLICY "output_assign_select" ON output_schedule_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active)
  );

DROP POLICY IF EXISTS "output_assign_all_admin" ON output_schedule_assignments;
CREATE POLICY "output_assign_all_admin" ON output_schedule_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operations','manager') AND is_active));
