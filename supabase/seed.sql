-- Seed data: one organization and one tutor
-- The tutor account is created via Supabase Auth, then linked here.
-- Run after supabase start and migrations.

-- Create organization
insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Trailhead Prep');

-- Note: The tutor must be created via Supabase Auth first.
-- After running `supabase start`, create the tutor user:
--   1. Go to http://localhost:54323 (Supabase Studio)
--   2. Authentication > Add User > Create User
--      Email: tutor@trailhead.test
--      Password: password123
--   3. Copy the user UUID and run:
--      INSERT INTO tutors (id, org_id, name, email)
--      VALUES ('<uuid>', '00000000-0000-0000-0000-000000000001', 'Demo Tutor', 'tutor@trailhead.test');

-- Alternatively, use the seed API route after starting the app:
-- POST /api/seed
