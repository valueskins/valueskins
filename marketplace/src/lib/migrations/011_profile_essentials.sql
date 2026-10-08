-- Migration 011: the profile essentials shown on the virtual resume.
--
-- Age is stored as the age the user gave plus the moment they gave it, so the
-- age shown grows by one each year without anyone editing it, and without
-- holding a date of birth we have no other use for.
--
-- profile_locked_at marks the one-time save: after it, only the follower count
-- can be changed.

ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_recorded_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_locked_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_age_chk;
ALTER TABLE users ADD CONSTRAINT users_age_chk CHECK (age IS NULL OR (age >= 18 AND age <= 99));
