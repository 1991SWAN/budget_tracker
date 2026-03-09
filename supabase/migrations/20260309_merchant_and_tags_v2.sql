-- 20260309_merchant_and_tags_v2.sql
-- Structure Improvement: Merchant column and Multi-user Tags

-- 1. Transactions Table: Add merchant column
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant text;
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions (merchant);

-- 2. Tags Table [FIX]: Add user_id for multi-user isolation
-- Note: Existing tags will have NULL user_id. We'll leave them as 'global' or delete them later.
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;

-- 3. Tags Table: Fix Constraints & RLS
-- First, ensure name/user_id combo is unique
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key; -- Remove old global unique
ALTER TABLE tags ADD CONSTRAINT tags_user_name_unique UNIQUE (user_id, name);

-- Enable RLS on tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
CREATE POLICY "Users can view their own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own tags" ON tags;
CREATE POLICY "Users can insert their own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
CREATE POLICY "Users can update their own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;
CREATE POLICY "Users can delete their own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- 4. Transaction Tags [NEW]: Join table for Many-to-Many
CREATE TABLE IF NOT EXISTS transaction_tags (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id text REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL, -- Reverted to uuid
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id, tag_id)
);

-- Enable RLS on transaction_tags
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own transaction_tags" 
ON transaction_tags FOR ALL 
USING (auth.uid() = user_id);

-- 5. Performance Indices
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id ON transaction_tags (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_user_id ON transaction_tags (user_id);
