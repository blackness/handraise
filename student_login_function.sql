-- ============================================================
-- HandRaise - student_login RPC function
-- Run this in Supabase SQL Editor after the main migration
-- ============================================================
-- This function is called from the React app to validate a
-- student's PIN and issue a session token. It runs with
-- SECURITY DEFINER so it can bypass RLS to check credentials.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION student_login(
  p_institution_id  UUID,
  p_student_id      TEXT,
  p_pin             TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student     student_profiles%ROWTYPE;
  v_token       TEXT;
  v_expires_at  TIMESTAMPTZ;
BEGIN
  -- Find the student by institution + student_id
  SELECT * INTO v_student
  FROM student_profiles
  WHERE institution_id = p_institution_id
    AND student_id     = p_student_id
    AND active         = TRUE;

  -- Student not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;

  -- Validate PIN using bcrypt
  IF NOT (v_student.pin_hash = crypt(p_pin, v_student.pin_hash)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;

  -- Generate a secure session token
  v_token      := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + INTERVAL '12 hours';

  -- Store it
  INSERT INTO student_sessions (student_id, token, expires_at)
  VALUES (v_student.id, v_token, v_expires_at);

  -- Return token + profile (exclude sensitive fields)
  RETURN jsonb_build_object(
    'success',  true,
    'token',    v_token,
    'profile',  jsonb_build_object(
      'id',                v_student.id,
      'full_name',         v_student.full_name,
      'company',           v_student.company,
      'work_position',     v_student.work_position,
      'profile_photo_url', v_student.profile_photo_url
    )
  );
END;
$$;


-- ============================================================
-- Helper: hash a PIN for insertion
-- Use this when creating/updating student PINs in the admin panel
-- Example: SELECT hash_pin('1234');
-- ============================================================

CREATE OR REPLACE FUNCTION hash_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT crypt(p_pin, gen_salt('bf'));
$$;


-- ============================================================
-- USAGE NOTES
-- ============================================================
-- When creating a student via the admin panel, hash their PIN:
--
--   INSERT INTO student_profiles (institution_id, student_id, pin_hash, full_name)
--   VALUES (
--     '<institution-id>',
--     'STU001',
--     hash_pin('1234'),
--     'Jane Smith'
--   );
--
-- When resetting a PIN via the admin panel:
--
--   UPDATE student_profiles
--   SET pin_hash = hash_pin('5678')
--   WHERE id = '<student-uuid>';
-- ============================================================
