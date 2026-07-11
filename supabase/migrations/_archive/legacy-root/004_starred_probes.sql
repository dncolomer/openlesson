-- Add starred column to probes table
ALTER TABLE probes ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;
