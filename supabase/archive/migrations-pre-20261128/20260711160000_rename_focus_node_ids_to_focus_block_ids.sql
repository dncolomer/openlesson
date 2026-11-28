-- Rename legacy focus_node_ids columns to focus_block_ids (block terminology).

ALTER TABLE public.workspace_tap_sessions
  RENAME COLUMN focus_node_ids TO focus_block_ids;

ALTER TABLE public.workspace_teach_backs
  RENAME COLUMN focus_node_ids TO focus_block_ids;