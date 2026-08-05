CREATE OR REPLACE FUNCTION public.qa_raise(p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'QA diagnostic raise %', p_code USING ERRCODE = p_code;
END $$;
REVOKE ALL ON FUNCTION public.qa_raise(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_raise(text) TO authenticated;