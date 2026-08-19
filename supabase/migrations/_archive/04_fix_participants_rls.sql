-- Fix participants RLS: admin full CRUD; supporter SELECT, INSERT, UPDATE only (no DELETE)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_all_participants" ON participants;
DROP POLICY IF EXISTS "supporter_all_participants" ON participants;
DROP POLICY IF EXISTS "participant_select_own" ON participants;
DROP POLICY IF EXISTS "admin insert" ON participants;
DROP POLICY IF EXISTS "admin update" ON participants;
DROP POLICY IF EXISTS "admin delete" ON participants;
DROP POLICY IF EXISTS "supporter_participants" ON participants;

-- Admin: full CRUD
CREATE POLICY "admin_all_participants" ON participants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Supporter: SELECT, INSERT, UPDATE (NO DELETE)
CREATE POLICY "supporter_participants_select" ON participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','supporter'))
  );

CREATE POLICY "supporter_participants_insert" ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','supporter'))
  );

CREATE POLICY "supporter_participants_update" ON participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','supporter'))
  );

-- Participant: select own record only
CREATE POLICY "participant_select_own" ON participants
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );
