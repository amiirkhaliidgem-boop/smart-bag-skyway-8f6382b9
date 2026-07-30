DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_read_only_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.dashboard_executive(timestamptz,timestamptz,text) TO supabase_read_only_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.dash_delta(int,int) TO supabase_read_only_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.dash_delta_num(numeric,numeric) TO supabase_read_only_user';
  END IF;
END $$;