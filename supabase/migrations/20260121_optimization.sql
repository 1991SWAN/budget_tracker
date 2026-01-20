-- Database Performance & Security Optimization Migration

-- 1. Performance Indices
-- Transactions: Optimized for timeline view and asset/category filtering
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions (asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_linked_id ON transactions (linked_transaction_id);

-- Assets: Optimized for user-specific lookups
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);

-- Recurring & Goals: Optimized for dashboard loading
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON savings_goals (user_id);

-- Categories: Optimized for sorting
CREATE INDEX IF NOT EXISTS idx_categories_user_sort ON categories (user_id, sort_order);

-- 2. Security Hardening (RLS blocks anonymous)
-- Helper function to check if user is NOT anonymous
CREATE OR REPLACE FUNCTION public.is_not_anonymous()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'is_anonymous')::boolean IS DISTINCT FROM TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to include anonymity check
-- Transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id AND is_not_anonymous());

-- Assets
DROP POLICY IF EXISTS "Users can view their own assets" ON assets;
CREATE POLICY "Users can view their own assets" ON assets FOR SELECT USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can insert their own assets" ON assets;
CREATE POLICY "Users can insert their own assets" ON assets FOR INSERT WITH CHECK (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can update their own assets" ON assets;
CREATE POLICY "Users can update their own assets" ON assets FOR UPDATE USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can delete their own assets" ON assets;
CREATE POLICY "Users can delete their own assets" ON assets FOR DELETE USING (auth.uid() = user_id AND is_not_anonymous());

-- Recurring
DROP POLICY IF EXISTS "Users can view their own recurring" ON recurring_transactions;
CREATE POLICY "Users can view their own recurring" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can insert their own recurring" ON recurring_transactions;
CREATE POLICY "Users can insert their own recurring" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can update their own recurring" ON recurring_transactions;
CREATE POLICY "Users can update their own recurring" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can delete their own recurring" ON recurring_transactions;
CREATE POLICY "Users can delete their own recurring" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id AND is_not_anonymous());

-- Goals
DROP POLICY IF EXISTS "Users can view their own goals" ON savings_goals;
CREATE POLICY "Users can view their own goals" ON savings_goals FOR SELECT USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can insert their own goals" ON savings_goals;
CREATE POLICY "Users can insert their own goals" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can update their own goals" ON savings_goals;
CREATE POLICY "Users can update their own goals" ON savings_goals FOR UPDATE USING (auth.uid() = user_id AND is_not_anonymous());
DROP POLICY IF EXISTS "Users can delete their own goals" ON savings_goals;
CREATE POLICY "Users can delete their own goals" ON savings_goals FOR DELETE USING (auth.uid() = user_id AND is_not_anonymous());
