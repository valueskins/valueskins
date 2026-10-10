-- Migration 012: the Instagram account type the role was taken from.
--
-- A user's role is not chosen: an Instagram Business account is a brand and an
-- Instagram Creator account is a creator. This column holds what Instagram
-- reported at the last successful read, so a role is only ever one that
-- Instagram confirmed, and an account with nothing here has not been confirmed.

ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_account_type TEXT DEFAULT '';
