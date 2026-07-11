-- Enable RLS on tables exposed via PostgREST that were missing enforcement.

-- profiles: policies already exist but RLS was off
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- session_transcript: metadata pointers to xAI transcript files
ALTER TABLE public.session_transcript ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transcripts"
  ON public.session_transcript
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transcripts"
  ON public.session_transcript
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own transcripts"
  ON public.session_transcript
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- session_audio: metadata pointers to session-audio storage blobs
ALTER TABLE public.session_audio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audio"
  ON public.session_audio
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own audio"
  ON public.session_audio
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own audio"
  ON public.session_audio
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());