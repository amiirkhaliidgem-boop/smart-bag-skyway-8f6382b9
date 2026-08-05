DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%40001%'
  LOOP
    d := replace(pg_get_functiondef(r.oid), '''40001''', '''PT409''');
    EXECUTE d;
  END LOOP;
END $$;