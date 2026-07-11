-- Create the vector similarity search function for RAG
CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding vector(3072),
  match_user_id uuid,
  match_session_id uuid DEFAULT null,
  match_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  transcript_id uuid,
  user_id uuid,
  chunk_index int,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.session_id,
    tc.transcript_id,
    tc.user_id,
    tc.chunk_index,
    tc.content,
    tc.metadata,
    tc.created_at,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM transcript_chunks tc
  WHERE 
    tc.user_id = match_user_id
    AND tc.embedding IS NOT NULL
    AND (match_session_id IS NULL OR tc.session_id != match_session_id)
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION match_transcript_chunks IS 
'Performs vector similarity search on transcript_chunks using cosine distance.
Returns chunks most similar to the query embedding for a given user.
Excludes the current session (if specified) to avoid retrieving current session content.';
