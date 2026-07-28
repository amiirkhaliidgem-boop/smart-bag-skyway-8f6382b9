DROP FUNCTION IF EXISTS public.save_app_state(bigint, jsonb);
DROP FUNCTION IF EXISTS public.archive_app_state_version() CASCADE;
DROP TABLE IF EXISTS public.app_state_history;
DROP TABLE IF EXISTS public.app_state;