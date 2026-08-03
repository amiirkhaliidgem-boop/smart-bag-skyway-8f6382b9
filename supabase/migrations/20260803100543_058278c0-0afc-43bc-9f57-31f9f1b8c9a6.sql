DO $mig$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.dashboard_executive(timestamptz,timestamptz,text)'::regprocedure);

  src := replace(src,
    E'                               ''Delivered'',''Closed'');',
    E'                               ''Delivered'',''Closed'',\n                               ''Ready for Airport Pickup'',''Passenger Picked Up'');');

  src := replace(src,
    E'''deliveredBags'',   jsonb_build_object(''value'', k_delivered,  ''delta'', public.dash_delta(c_delivered, p_delivered)),',
    E'''deliveredBags'',   jsonb_build_object(''value'', k_delivered,  ''delta'', public.dash_delta(\n'
    || E'        c_delivered + (SELECT count(*)::int FROM public.workflow_events w WHERE w.to_status = ''PASSENGER_PICKED_UP'' AND w.occurred_at >= p_from AND w.occurred_at < p_to),\n'
    || E'        p_delivered + (SELECT count(*)::int FROM public.workflow_events w WHERE w.to_status = ''PASSENGER_PICKED_UP'' AND w.occurred_at >= prev_from AND w.occurred_at < prev_to))),');

  src := replace(src,
    E'          (SELECT count(*) FROM public.deliveries dl\n            WHERE dl.delivered_at IS NOT NULL AND date_trunc(g, dl.delivered_at) = d.bucket) AS delivered,',
    E'          ((SELECT count(*) FROM public.deliveries dl\n             WHERE dl.delivered_at IS NOT NULL AND date_trunc(g, dl.delivered_at) = d.bucket)\n           + (SELECT count(*) FROM public.workflow_events w\n               WHERE w.to_status = ''PASSENGER_PICKED_UP'' AND date_trunc(g, w.occurred_at) = d.bucket)) AS delivered,');

  EXECUTE src;
END
$mig$;