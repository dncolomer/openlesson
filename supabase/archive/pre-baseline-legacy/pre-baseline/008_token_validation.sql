-- Add token tier and validation fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS token_tier TEXT CHECK (token_tier IN ('regular', 'pro', NULL)),
ADD COLUMN IF NOT EXISTS wallet_address TEXT,
ADD COLUMN IF NOT EXISTS token_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS token_validity_expires_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_token_tier ON profiles(token_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_token_expiry ON profiles(token_validity_expires_at);
