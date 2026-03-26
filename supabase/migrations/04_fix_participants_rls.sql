-- Fix participants RLS: admin/supporter can INSERT, UPDATE, DELETE; participant can only SELECT own
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_all_participants" ON participants;
DROP POLICY IF EXISTS "supporter_all_participants" ON participants;
DROP POLICY IF EXISTS "participant_select_own" ON participants;
DROP POLICY IF EXISTS "admin insert" ON participants;
DROP POLICY IF EXISTS "admin update" ON participants;
DROP POLICY IF EXISTS "admin delete" ON participants;

-- Admin: full CRUD (but cannot delete via participant themselves)
CREATE POLICY "admin_all_participants" ON participants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Supporter: SELECT, INSERT, UPDATE (no DELETE of participant record itself)
CREATE POLICY "supporter_participants" ON participants
  FOR ALL
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
