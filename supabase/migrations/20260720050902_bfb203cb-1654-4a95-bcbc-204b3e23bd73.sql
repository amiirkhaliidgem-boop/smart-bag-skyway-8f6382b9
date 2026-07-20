
CREATE TABLE IF NOT EXISTS public.passenger_links (
  token         text PRIMARY KEY,
  delivery_id   text NOT NULL,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  channel       text NOT NULL DEFAULT 'staff_preview'
);
GRANT SELECT, INSERT, UPDATE ON public.passenger_links TO authenticated;
GRANT ALL ON public.passenger_links TO service_role;
ALTER TABLE public.passenger_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read passenger_links" ON public.passenger_links;
DROP POLICY IF EXISTS "staff insert passenger_links" ON public.passenger_links;
DROP POLICY IF EXISTS "staff update passenger_links" ON public.passenger_links;
CREATE POLICY "staff read passenger_links" ON public.passenger_links FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff insert passenger_links" ON public.passenger_links FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff update passenger_links" ON public.passenger_links FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS passenger_links_delivery_idx ON public.passenger_links(delivery_id);

CREATE TABLE IF NOT EXISTS public.delivery_public_view (
  delivery_id     text PRIMARY KEY,
  bag_id          text,
  passenger_name  text,
  status          text,
  stage           text,
  bag_tag         text,
  airline         text,
  flight_no       text,
  flight_date     date,
  otp_code        text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_public_view TO authenticated;
GRANT ALL ON public.delivery_public_view TO service_role;
ALTER TABLE public.delivery_public_view ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read delivery_public_view" ON public.delivery_public_view;
DROP POLICY IF EXISTS "staff write delivery_public_view" ON public.delivery_public_view;
DROP POLICY IF EXISTS "staff update delivery_public_view" ON public.delivery_public_view;
CREATE POLICY "staff read delivery_public_view" ON public.delivery_public_view FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff write delivery_public_view" ON public.delivery_public_view FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff update delivery_public_view" ON public.delivery_public_view FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.passenger_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  text NOT NULL,
  token        text NOT NULL,
  rating       int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  resolved     boolean NOT NULL DEFAULT true,
  comments     text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.passenger_feedback TO authenticated;
GRANT ALL ON public.passenger_feedback TO service_role;
ALTER TABLE public.passenger_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read passenger_feedback" ON public.passenger_feedback;
CREATE POLICY "staff read passenger_feedback" ON public.passenger_feedback FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);


CREATE OR REPLACE FUNCTION public.get_passenger_view(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.passenger_links%ROWTYPE;
  v_view public.delivery_public_view%ROWTYPE;
  v_expose_otp boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 4 THEN RETURN NULL; END IF;
  SELECT * INTO v_link FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_view FROM public.delivery_public_view WHERE delivery_id = v_link.delivery_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_expose_otp := v_view.stage IN ('Assigned','Driver Accepted','Collected Bag','Out for Delivery');
  RETURN jsonb_build_object(
    'passenger_name', v_view.passenger_name,
    'status', v_view.status,
    'stage', v_view.stage,
    'bag_tag', v_view.bag_tag,
    'airline', v_view.airline,
    'flight_no', v_view.flight_no,
    'flight_date', v_view.flight_date,
    'otp_code', CASE WHEN v_expose_otp THEN v_view.otp_code ELSE NULL END
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_passenger_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_passenger_view(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public._passenger_apply_action(p_token text, p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.passenger_links%ROWTYPE;
  v_row public.app_state%ROWTYPE;
  v_payload jsonb; v_workflow jsonb; v_deliveries jsonb; v_cases jsonb;
  v_feedback jsonb; v_incidents jsonb; v_callLogs jsonb; v_audit jsonb;
  v_now text := to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_delivery_id text; v_bag_id text; v_passenger_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 4 THEN RETURN false; END IF;
  SELECT * INTO v_link FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN false; END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN RETURN false; END IF;
  v_delivery_id := v_link.delivery_id;

  SELECT * INTO v_row FROM public.app_state WHERE id='global' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_payload := coalesce(v_row.payload,'{}'::jsonb);
  v_workflow   := coalesce(v_payload->'workflow','[]'::jsonb);
  v_deliveries := coalesce(v_payload->'deliveries','[]'::jsonb);
  v_cases      := coalesce(v_payload->'cases','[]'::jsonb);
  v_feedback   := coalesce(v_payload->'feedback','[]'::jsonb);
  v_incidents  := coalesce(v_payload->'qualityIncidents','[]'::jsonb);
  v_callLogs   := coalesce(v_payload->'callLogs','[]'::jsonb);
  v_audit      := coalesce(v_payload->'audit','[]'::jsonb);

  SELECT (d->>'bagId'), (d->>'passengerName') INTO v_bag_id, v_passenger_name
    FROM jsonb_array_elements(v_deliveries) d
    WHERE d->>'deliveryId' = v_delivery_id LIMIT 1;
  IF v_bag_id IS NULL THEN RETURN false; END IF;

  IF p_action = 'confirm-delivery' THEN
    v_deliveries := (SELECT jsonb_agg(CASE WHEN d->>'deliveryId'=v_delivery_id
      THEN d || jsonb_build_object('status','Delivered','stage','Delivered','otpStatus','Verified','deliveredAt',v_now,'lastUpdatedAt',v_now)
      ELSE d END) FROM jsonb_array_elements(v_deliveries) d);
    v_cases := (SELECT jsonb_agg(CASE WHEN c->>'bagId'=v_bag_id
      THEN c || jsonb_build_object('status','Delivered','lfStatus','Delivered','resolvedAt',coalesce(c->>'resolvedAt',v_now),'updatedAt',v_now)
      ELSE c END) FROM jsonb_array_elements(v_cases) c);
    v_workflow := (SELECT jsonb_agg(CASE WHEN w->>'token'=p_token
      THEN w || jsonb_build_object('status','DELIVERED','history',
        coalesce(w->'history','[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('status','OTP_VERIFIED','at',v_now,'actor','Passenger Portal'),
          jsonb_build_object('status','DELIVERED','at',v_now,'actor','Passenger Portal')))
      ELSE w END) FROM jsonb_array_elements(v_workflow) w);
    v_audit := jsonb_build_array(jsonb_build_object('id','AUD-'||gen_random_uuid()::text,'action','workflow.transition','actor','Passenger Portal','entityType','delivery','entityId',v_delivery_id,'note','OTP verified; baggage delivered · Case '||v_bag_id,'at',v_now)) || v_audit;

  ELSIF p_action = 'report-misconduct' THEN
    v_incidents := jsonb_build_array(jsonb_build_object('id','INC-'||gen_random_uuid()::text,'bagId',v_bag_id,'deliveryId',v_delivery_id,'passengerName',v_passenger_name,'category','Possible Misconduct','severity','High','status','Open','description','Passenger reported a request for money, tips, gifts or unofficial payment.','at',v_now)) || v_incidents;
    v_callLogs := jsonb_build_array(jsonb_build_object('id','CALL-'||gen_random_uuid()::text,'bagId',v_bag_id,'passengerName',v_passenger_name,'agent','System Alert','direction','Callback Required','durationSec',0,'notes','HIGH PRIORITY — Possible misconduct reported via Passenger Portal.','at',v_now)) || v_callLogs;
    v_audit := jsonb_build_array(jsonb_build_object('id','AUD-'||gen_random_uuid()::text,'action','incident.create','actor','Passenger Portal','entityType','delivery','entityId',v_delivery_id,'note','Possible misconduct reported · Case '||v_bag_id,'at',v_now)) || v_audit;

  ELSIF p_action = 'feedback-submitted' THEN
    v_workflow := (SELECT jsonb_agg(CASE WHEN w->>'token'=p_token
      THEN w || jsonb_build_object('status','FEEDBACK_SUBMITTED','history',
        coalesce(w->'history','[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('status','FEEDBACK_SUBMITTED','at',v_now,'actor','Passenger Portal')))
      ELSE w END) FROM jsonb_array_elements(v_workflow) w);
    v_audit := jsonb_build_array(jsonb_build_object('id','AUD-'||gen_random_uuid()::text,'action','workflow.transition','actor','Passenger Portal','entityType','delivery','entityId',v_delivery_id,'note','Passenger feedback submitted · Case '||v_bag_id,'at',v_now)) || v_audit;
  ELSE
    RETURN false;
  END IF;

  v_payload := v_payload
    || jsonb_build_object('workflow',v_workflow)
    || jsonb_build_object('deliveries',v_deliveries)
    || jsonb_build_object('cases',v_cases)
    || jsonb_build_object('audit',v_audit)
    || jsonb_build_object('qualityIncidents',v_incidents)
    || jsonb_build_object('callLogs',v_callLogs)
    || jsonb_build_object('feedback',v_feedback);

  UPDATE public.app_state SET payload=v_payload, version=v_row.version+1, updated_at=now() WHERE id='global';
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public._passenger_apply_action(text,text) FROM PUBLIC;


CREATE OR REPLACE FUNCTION public.passenger_confirm_delivery(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN public._passenger_apply_action(p_token,'confirm-delivery'); END; $$;
REVOKE ALL ON FUNCTION public.passenger_confirm_delivery(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passenger_confirm_delivery(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.passenger_report_misconduct(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN public._passenger_apply_action(p_token,'report-misconduct'); END; $$;
REVOKE ALL ON FUNCTION public.passenger_report_misconduct(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passenger_report_misconduct(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.passenger_submit_feedback(p_token text, p_rating int, p_resolved boolean, p_comments text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_link public.passenger_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 4 THEN RETURN false; END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;
  SELECT * INTO v_link FROM public.passenger_links WHERE token=p_token;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN false; END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN RETURN false; END IF;
  INSERT INTO public.passenger_feedback(delivery_id, token, rating, resolved, comments)
  VALUES (v_link.delivery_id, p_token, p_rating, coalesce(p_resolved,true), coalesce(p_comments,''));
  PERFORM public._passenger_apply_action(p_token,'feedback-submitted');
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.passenger_submit_feedback(text,int,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passenger_submit_feedback(text,int,boolean,text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.sync_passenger_public_from_app_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payload jsonb := coalesce(NEW.payload,'{}'::jsonb);
BEGIN
  INSERT INTO public.passenger_links (token, delivery_id, channel)
  SELECT w->>'token', w->>'deliveryId', 'staff_preview'
    FROM jsonb_array_elements(coalesce(v_payload->'workflow','[]'::jsonb)) w
   WHERE (w->>'token') IS NOT NULL AND length(w->>'token') >= 4
  ON CONFLICT (token) DO UPDATE SET delivery_id = EXCLUDED.delivery_id;

  INSERT INTO public.delivery_public_view (
    delivery_id, bag_id, passenger_name, status, stage,
    bag_tag, airline, flight_no, flight_date, otp_code, updated_at)
  SELECT
    d->>'deliveryId',
    d->>'bagId',
    d->>'passengerName',
    d->>'status',
    d->>'stage',
    coalesce(kase->>'bagTagNumber', (kase->'baggage'->'bagTags'->>0)),
    kase->'flight'->>'airline',
    kase->>'flightNumber',
    NULLIF(kase->>'arrivalDate','')::date,
    d->>'otpCode',
    now()
  FROM jsonb_array_elements(coalesce(v_payload->'deliveries','[]'::jsonb)) d
  LEFT JOIN LATERAL (
    SELECT c AS kase FROM jsonb_array_elements(coalesce(v_payload->'cases','[]'::jsonb)) c
     WHERE c->>'bagId' = d->>'bagId' LIMIT 1
  ) k ON true
  ON CONFLICT (delivery_id) DO UPDATE SET
    bag_id=EXCLUDED.bag_id, passenger_name=EXCLUDED.passenger_name,
    status=EXCLUDED.status, stage=EXCLUDED.stage, bag_tag=EXCLUDED.bag_tag,
    airline=EXCLUDED.airline, flight_no=EXCLUDED.flight_no,
    flight_date=EXCLUDED.flight_date, otp_code=EXCLUDED.otp_code, updated_at=now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_passenger_public ON public.app_state;
CREATE TRIGGER trg_sync_passenger_public
  AFTER INSERT OR UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.sync_passenger_public_from_app_state();

-- Backfill
UPDATE public.app_state SET updated_at = now() WHERE id = 'global';
