REVOKE EXECUTE ON FUNCTION public.settings_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settings_group(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settings_get_all() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settings_save(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sla_region_upsert(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sla_region_delete(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notif_template_upsert(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wf_queue_notification_key(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sla_delivery_hours(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.settings_get_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.settings_save(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sla_region_upsert(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sla_region_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notif_template_upsert(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settings_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sla_delivery_hours(uuid) TO authenticated;