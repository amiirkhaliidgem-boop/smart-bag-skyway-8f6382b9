REVOKE ALL ON FUNCTION public.wf_ensure_case_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wf_queue_case_notification(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wf_block_pickup_delivery() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_allowed_statuses(public.delivery_method) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_allowed_statuses(public.delivery_method) TO authenticated;