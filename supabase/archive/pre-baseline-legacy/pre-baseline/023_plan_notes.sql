-- Add notes column to learning_plans for README-like plan notes
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS notes TEXT;
