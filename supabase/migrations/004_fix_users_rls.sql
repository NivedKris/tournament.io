-- ============================================================
-- Migration 004: Fix Users & App Tables RLS for Service Role
-- ============================================================

-- Users policies
DROP POLICY IF EXISTS "service insert users" ON users;
CREATE POLICY "service insert users" ON users
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "service update users" ON users;
CREATE POLICY "service update users" ON users
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service delete users" ON users;
CREATE POLICY "service delete users" ON users
  FOR DELETE TO service_role USING (true);

-- Tournaments policies
DROP POLICY IF EXISTS "service write tournaments" ON tournaments;
CREATE POLICY "service write tournaments" ON tournaments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Nations policies
DROP POLICY IF EXISTS "service write nations" ON nations;
CREATE POLICY "service write nations" ON nations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Nation Claims policies
DROP POLICY IF EXISTS "service write nation_claims" ON nation_claims;
CREATE POLICY "service write nation_claims" ON nation_claims
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Players policies
DROP POLICY IF EXISTS "service write players" ON players;
CREATE POLICY "service write players" ON players
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Squads policies
DROP POLICY IF EXISTS "service write squads" ON squads;
CREATE POLICY "service write squads" ON squads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Matches policies
DROP POLICY IF EXISTS "service write matches" ON matches;
CREATE POLICY "service write matches" ON matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Messages policies
DROP POLICY IF EXISTS "service write messages" ON messages;
CREATE POLICY "service write messages" ON messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Disputes policies
DROP POLICY IF EXISTS "service write disputes" ON disputes;
CREATE POLICY "service write disputes" ON disputes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
