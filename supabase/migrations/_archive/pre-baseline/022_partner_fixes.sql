-- Fix: Add DELETE RLS policy on partners table (required for confirm-unstake)
CREATE POLICY "Users can delete own partner record"
  ON partners FOR DELETE USING (auth.uid() = user_id);

-- Add wallet_address column to partners table (needed for token return on unstake)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS wallet_address TEXT;
