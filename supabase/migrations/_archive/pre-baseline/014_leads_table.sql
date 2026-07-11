-- Create leads table for B2B lead capture
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  role TEXT,
  size TEXT,
  audience TEXT NOT NULL, -- 'enterprise' | 'schools' | 'hr'
  message TEXT,
  status TEXT DEFAULT 'new' -- 'new' | 'contacted' | 'converted' | 'closed'
);

-- Create index for querying by status
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Create index for querying by audience
CREATE INDEX IF NOT EXISTS idx_leads_audience ON leads(audience);

-- Create index for querying by created_at for recent leads
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- RLS: Only admins can read leads (you'll need to manage this via service role in API)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert from anyone (public lead capture)
CREATE POLICY "Allow public lead submission" ON leads
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only service role / admin can select leads
-- (handled via service role key in API route, no user-facing select policy)
