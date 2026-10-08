-- Migration 010: the name on the creator's UPI account.
--
-- A brand's UPI app shows the registered payee name before it sends money. With
-- the creator's own statement of that name next to the UPI ID, the brand can
-- compare the two and stop if they differ, which is the only check available
-- without a payments provider validating the ID.

ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_name TEXT DEFAULT '';
