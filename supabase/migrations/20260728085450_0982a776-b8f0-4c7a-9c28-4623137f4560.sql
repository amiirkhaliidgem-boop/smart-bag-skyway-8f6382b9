CREATE TABLE public.app_state_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_state_id text NOT NULL,
  payload jsonb NOT NULL,
  version bigint NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid
);

GRANT ALL ON public.app_state_history TO service_role;

ALTER TABLE public.app_state_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX app_state_history_state_version_idx
  ON public.app_state_history (app_state_id, version DESC);

CREATE OR REPLACE FUNCTION public.archive_app_state_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.payload IS DISTINCT FROM NEW.payload OR OLD.version IS DISTINCT FROM NEW.version THEN
    INSERT INTO public.app_state_history (
      app_state_id,
      payload,
      version,
      archived_by
    ) VALUES (
      OLD.id,
      OLD.payload,
      OLD.version,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_app_state_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_app_state_version() TO service_role;

DROP TRIGGER IF EXISTS archive_app_state_before_update ON public.app_state;
CREATE TRIGGER archive_app_state_before_update
BEFORE UPDATE ON public.app_state
FOR EACH ROW
EXECUTE FUNCTION public.archive_app_state_version();

CREATE OR REPLACE FUNCTION public.save_app_state(
  p_expected_version bigint,
  p_payload jsonb
)
RETURNS TABLE(saved boolean, current_version bigint, current_payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users u
    WHERE u.user_id = v_user_id
      AND u.status = 'Active'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Active operational account required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.app_state
  SET payload = p_payload,
      version = version + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = 'global'
    AND version = p_expected_version;

  IF FOUND THEN
    RETURN QUERY
      SELECT true, s.version, s.payload
      FROM public.app_state s
      WHERE s.id = 'global';
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, s.version, s.payload
    FROM public.app_state s
    WHERE s.id = 'global';
END;
$$;

REVOKE ALL ON FUNCTION public.save_app_state(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_app_state(bigint, jsonb) TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.app_state FROM authenticated;
GRANT SELECT ON public.app_state TO authenticated;
GRANT ALL ON public.app_state TO service_role;

DROP POLICY IF EXISTS "staff read app_state" ON public.app_state;
DROP POLICY IF EXISTS "staff update app_state" ON public.app_state;
DROP POLICY IF EXISTS "staff upsert app_state" ON public.app_state;

CREATE POLICY "active operational users read app_state"
ON public.app_state
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.user_id = auth.uid() AND u.status = 'Active'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_delivery_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_delivery_agents() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;