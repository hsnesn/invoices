-- Allow producers to delete their own invited guests; admin can delete any.
-- Deleting from producer_guests does NOT affect guest_contacts (contact list).

CREATE POLICY "producer_guests_delete_own"
  ON producer_guests FOR DELETE
  USING (producer_user_id = auth.uid());

CREATE POLICY "producer_guests_delete_admin"
  ON producer_guests FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
