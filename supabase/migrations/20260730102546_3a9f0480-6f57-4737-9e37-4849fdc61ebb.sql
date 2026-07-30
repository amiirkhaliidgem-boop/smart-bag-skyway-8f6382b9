GRANT EXECUTE ON FUNCTION public.dashboard_executive(timestamptz,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dash_delta(int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.dash_delta_num(numeric,numeric) TO service_role;