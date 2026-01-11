-- 1. Clean up orphaned data (Data created before Auth was implemented)
-- Since we added the user_id column newly, all old data has user_id = NULL.
-- We should verify there is no important data here. User said it's "fake data".

DELETE FROM transactions WHERE user_id IS NULL;
DELETE FROM assets WHERE user_id IS NULL;
DELETE FROM recurring_transactions WHERE user_id IS NULL;
DELETE FROM savings_goals WHERE user_id IS NULL;

-- 2. Force Enable RLS (In case it failed previously)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- 3. Safety Check: Make user_id NOT NULL to prevent future orphans?
-- Only IF we are sure all rows have user_id now. (After delete, table should be empty or only have valid user_id)
-- ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
-- (Commented out to avoid error if table is not empty/has issues, but recommended for production)
