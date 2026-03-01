-- Allow delete on guest_invitations for invited guests management.
-- Admin can delete any; others can delete their own (producer_user_id = auth.uid()).

CREATE POLICY "guest_invitations_delete_admin"
  ON guest_invitations FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "guest_invitations_delete_own"
  ON guest_invitations FOR DELETE
  USING (producer_user_id = auth.uid());
