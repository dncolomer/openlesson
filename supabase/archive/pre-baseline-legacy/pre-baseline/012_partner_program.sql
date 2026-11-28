-- Partner Program Tables

-- Partners table
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  stake_amount INTEGER NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  stripe_account_id TEXT,
  stripe_account_status TEXT DEFAULT 'not_connected' CHECK (stripe_account_status IN ('not_connected', 'pending', 'connected')),
  total_revenue_claimed DECIMAL(12,2) DEFAULT 0,
  last_payout_at TIMESTAMPTZ,
  unstake_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner referrals table (tracks which users were referred by which partner)
CREATE TABLE partner_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, referred_user_id)
);

-- Partner revenue table (tracks unclaimed revenue)
CREATE TABLE partner_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  source_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_subscription_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_referral_code ON partners(referral_code);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_referred_user_id ON partner_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_revenue_partner_id ON partner_revenue(partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_unstake_requested ON partners(unstake_requested_at) WHERE unstake_requested_at IS NOT NULL;

-- Enable RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_revenue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners
CREATE POLICY "Users can view own partner record"
  ON partners FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own partner record"
  ON partners FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own partner record"
  ON partners FOR UPDATE USING (auth.uid() = user_id);

-- Admins can manage all partners
CREATE POLICY "Admins can view all partners"
  ON partners FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update all partners"
  ON partners FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Partner referrals policies
CREATE POLICY "Partners can view own referrals"
  ON partner_referrals FOR SELECT USING (
    EXISTS (SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their own referral info"
  ON partner_referrals FOR SELECT USING (auth.uid() = referred_user_id);

CREATE POLICY "Anyone can insert referrals via API"
  ON partner_referrals FOR INSERT WITH CHECK (true);

-- Admins can view all referrals
CREATE POLICY "Admins can view all partner referrals"
  ON partner_referrals FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Partner revenue policies
CREATE POLICY "Partners can view own revenue"
  ON partner_revenue FOR SELECT USING (
    EXISTS (SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid())
  );

-- Admins can view all revenue
CREATE POLICY "Admins can view all partner revenue"
  ON partner_revenue FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Partners can insert own revenue"
  ON partner_revenue FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid())
  );

-- Create a function to get partner by referral code (public access for registration)
CREATE OR REPLACE FUNCTION get_partner_by_referral_code(code TEXT)
RETURNS UUID AS $$
DECLARE
  partner_uuid UUID;
BEGIN
  SELECT id INTO partner_uuid FROM partners WHERE LOWER(referral_code) = LOWER(code) LIMIT 1;
  RETURN partner_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
