DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT pid FROM pg_stat_activity
           WHERE usename = 'authenticator' AND state LIKE 'idle in transaction%'
  LOOP
    PERFORM pg_terminate_backend(r.pid);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';