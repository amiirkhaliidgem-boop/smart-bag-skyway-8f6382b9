CREATE OR REPLACE FUNCTION public.passenger_get_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.passenger_links%ROWTYPE; v public.passenger_view%ROWTYPE; expose boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.passenger_view WHERE delivery_id = l.delivery_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.passenger_links
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE id = l.id;

  -- Business rule: the one-time code is revealed only while the bag is
  -- actively out for delivery (including a failed attempt awaiting retry),
  -- and never once the delivery is completed or returned to the airport.
  expose := v.stage IN ('Out for Delivery','Delivery Failed')
            AND coalesce(v.otp_state::text,'') NOT IN ('Verified','Expired');

  RETURN jsonb_build_object(
    'passenger_name', v.passenger_name,
    'stage', v.stage,
    'status', v.workflow_status,
    'pir_number', v.pir_number,
    'bag_tag', v.bag_tag,
    'airline', v.airline,
    'flight_no', v.flight_no,
    'flight_date', v.flight_date,
    'delivered_at', v.delivered_at,
    'otp_code', CASE WHEN expose THEN v.otp_code ELSE NULL END);
END; $function$;