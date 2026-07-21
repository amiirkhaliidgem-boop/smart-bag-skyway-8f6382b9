ALTER TABLE public.delivery_public_view ADD COLUMN IF NOT EXISTS pir_number text;

CREATE OR REPLACE FUNCTION public.sync_passenger_public_from_app_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_payload jsonb := coalesce(NEW.payload,'{}'::jsonb);
BEGIN
  INSERT INTO public.passenger_links (token, delivery_id, channel)
  SELECT w->>'token', w->>'deliveryId', 'staff_preview'
    FROM jsonb_array_elements(coalesce(v_payload->'workflow','[]'::jsonb)) w
   WHERE (w->>'token') IS NOT NULL AND length(w->>'token') >= 4
  ON CONFLICT (token) DO UPDATE SET delivery_id = EXCLUDED.delivery_id;

  INSERT INTO public.delivery_public_view (
    delivery_id, bag_id, passenger_name, status, stage,
    bag_tag, airline, flight_no, flight_date, otp_code, pir_number, updated_at)
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
    coalesce(d->>'pirNumber', kase->>'pirNumber'),
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
    flight_date=EXCLUDED.flight_date, otp_code=EXCLUDED.otp_code,
    pir_number=EXCLUDED.pir_number, updated_at=now();
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_passenger_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'pir_number', v_view.pir_number,
    'otp_code', CASE WHEN v_expose_otp THEN v_view.otp_code ELSE NULL END
  );
END; $function$;

DO $$
DECLARE v_payload jsonb;
BEGIN
  SELECT payload INTO v_payload FROM public.app_state WHERE id='global';
  IF v_payload IS NOT NULL THEN
    UPDATE public.delivery_public_view dpv
       SET pir_number = coalesce(d->>'pirNumber', kase->>'pirNumber'),
           updated_at = now()
      FROM jsonb_array_elements(coalesce(v_payload->'deliveries','[]'::jsonb)) d
      LEFT JOIN LATERAL (
        SELECT c AS kase FROM jsonb_array_elements(coalesce(v_payload->'cases','[]'::jsonb)) c
         WHERE c->>'bagId' = d->>'bagId' LIMIT 1
      ) k ON true
     WHERE dpv.delivery_id = d->>'deliveryId';
  END IF;
END $$;