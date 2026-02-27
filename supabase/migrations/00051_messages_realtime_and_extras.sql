-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Message threading
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

-- File attachments (store path in Supabase Storage)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name text;

-- Conversation mute (user_id mutes peer_id)
CREATE TABLE IF NOT EXISTS conversation_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  peer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, peer_id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_mutes_user ON conversation_mutes(user_id);
ALTER TABLE conversation_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mutes_select_own" ON conversation_mutes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mutes_insert_own" ON conversation_mutes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "mutes_delete_own" ON conversation_mutes FOR DELETE TO authenticated USING (user_id = auth.uid());
