-- Soft-delete flag for payments.
-- The Payments page (on load) and the daily cron both auto-generate the current
-- month's bills for active tenants. A hard delete therefore gets recreated.
-- Marking a row hidden=true keeps it in the table (so the upsert's ON CONFLICT
-- skips it) but filtered out of every view, so an owner's delete actually sticks.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
