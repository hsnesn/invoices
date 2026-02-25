-- Ensure operations_room_members exists (may have been skipped if 00014 was repaired as applied)
CREATE TABLE IF NOT EXISTS operations_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE operations_room_members IS 'Users assigned to The Operations Room - can approve freelancer invoices at pending_admin stage';

CREATE INDEX IF NOT EXISTS idx_operations_room_members_user ON operations_room_members(user_id);

ALTER TABLE operations_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access operations_room" ON operations_room_members;
CREATE POLICY "Admin full access operations_room"
  ON operations_room_members FOR ALL
  USING (true)
  WITH CHECK (true);
