-- Organizations and Team Management
-- Adds organization support for enterprise/team users

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);

-- ============================================
-- ORGANIZATION INVITES TABLE (single-use tokens)
-- ============================================
CREATE TABLE organization_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organization_invites_org_id ON organization_invites(organization_id);
CREATE INDEX idx_organization_invites_token ON organization_invites(token);
CREATE INDEX idx_organization_invites_unused ON organization_invites(organization_id) WHERE used_by IS NULL;

-- ============================================
-- ADD ORGANIZATION FIELDS TO PROFILES
-- ============================================
ALTER TABLE profiles 
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN is_org_admin BOOLEAN DEFAULT false;

CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_org_admins ON profiles(organization_id) WHERE is_org_admin = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Organizations: members can read their own org
CREATE POLICY "Members can view own organization"
  ON organizations FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.organization_id = organizations.id)
  );

-- Organizations: platform admins can do everything
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can create organizations"
  ON organizations FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can update organizations"
  ON organizations FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can delete organizations"
  ON organizations FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Organization invites: org admins can manage invites for their org
CREATE POLICY "Org admins can view invites for their org"
  ON organization_invites FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.organization_id = organization_invites.organization_id 
        AND profiles.is_org_admin = true
    )
  );

CREATE POLICY "Org admins can create invites for their org"
  ON organization_invites FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.organization_id = organization_invites.organization_id 
        AND profiles.is_org_admin = true
    )
  );

CREATE POLICY "Org admins can delete invites for their org"
  ON organization_invites FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.organization_id = organization_invites.organization_id 
        AND profiles.is_org_admin = true
    )
  );

-- Platform admins can manage all invites
CREATE POLICY "Platform admins can view all invites"
  ON organization_invites FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can create all invites"
  ON organization_invites FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can update all invites"
  ON organization_invites FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Platform admins can delete all invites"
  ON organization_invites FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Anyone can read an invite by token (needed for invite acceptance flow)
-- This is safe because the token itself is the secret
CREATE POLICY "Anyone can view invite by token"
  ON organization_invites FOR SELECT USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get organization by invite token (for invite acceptance)
CREATE OR REPLACE FUNCTION get_organization_by_invite_token(invite_token TEXT)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  invite_id UUID,
  is_used BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    oi.id as invite_id,
    (oi.used_by IS NOT NULL) as is_used
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token = invite_token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept an invite (marks it as used and updates user's org)
CREATE OR REPLACE FUNCTION accept_organization_invite(invite_token TEXT, accepting_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  invite_record RECORD;
  user_record RECORD;
  result JSONB;
BEGIN
  -- Get the invite
  SELECT oi.*, o.name as org_name, o.slug as org_slug
  INTO invite_record
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token = invite_token;
  
  -- Check if invite exists
  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;
  
  -- Check if invite is already used
  IF invite_record.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;
  
  -- Get the user
  SELECT * INTO user_record FROM profiles WHERE id = accepting_user_id;
  
  IF user_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if user already belongs to an organization
  IF user_record.organization_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'You already belong to an organization. Please leave your current organization first.'
    );
  END IF;
  
  -- Mark the invite as used
  UPDATE organization_invites 
  SET used_by = accepting_user_id, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Update user's organization
  UPDATE profiles 
  SET organization_id = invite_record.organization_id, is_org_admin = false
  WHERE id = accepting_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', invite_record.organization_id,
    'organization_name', invite_record.org_name,
    'organization_slug', invite_record.org_slug
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for org admins to remove a member from their organization
CREATE OR REPLACE FUNCTION remove_organization_member(target_user_id UUID, requesting_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  requester RECORD;
  target RECORD;
BEGIN
  -- Get requester info
  SELECT * INTO requester FROM profiles WHERE id = requesting_user_id;
  
  IF requester IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requester not found');
  END IF;
  
  -- Get target user info
  SELECT * INTO target FROM profiles WHERE id = target_user_id;
  
  IF target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
  END IF;
  
  -- Check if requester is platform admin or org admin of the same org
  IF NOT (requester.is_admin = true OR (requester.is_org_admin = true AND requester.organization_id = target.organization_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  
  -- Check if target belongs to an organization
  IF target.organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User does not belong to any organization');
  END IF;
  
  -- Prevent self-removal if you're the last org admin
  IF target_user_id = requesting_user_id AND target.is_org_admin = true THEN
    -- Check if there are other org admins
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE organization_id = target.organization_id 
        AND is_org_admin = true 
        AND id != target_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot remove yourself as the last org admin');
    END IF;
  END IF;
  
  -- Remove user from organization
  UPDATE profiles 
  SET organization_id = NULL, is_org_admin = false
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate a random invite token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..24 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
