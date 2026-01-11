-- 1. Add user_id column if not exists (Safe to run multiple times if using IF NOT EXISTS logic, but basic ADD COLUMN is fine here)
-- Note: We make it nullable first to handle existing rows (they will have NULL)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;

-- 2. Enable RLS on all data tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Select (Read)
-- Existing rows with NULL user_id will result in (auth.uid() = NULL) -> False, so they are hidden. Perfect!
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own assets" ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own recurring" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own goals" ON savings_goals FOR SELECT USING (auth.uid() = user_id);

-- 4. Policy: Insert (Create)
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert their own assets" ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurring" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Policy: Update
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own assets" ON assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON savings_goals FOR UPDATE USING (auth.uid() = user_id);

-- 6. Policy: Delete
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assets" ON assets FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON savings_goals FOR DELETE USING (auth.uid() = user_id);
