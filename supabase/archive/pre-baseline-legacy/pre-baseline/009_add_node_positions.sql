-- Add position columns to plan_nodes for graph layout persistence
ALTER TABLE plan_nodes 
ADD COLUMN IF NOT EXISTS position_x INTEGER,
ADD COLUMN IF NOT EXISTS position_y INTEGER;
