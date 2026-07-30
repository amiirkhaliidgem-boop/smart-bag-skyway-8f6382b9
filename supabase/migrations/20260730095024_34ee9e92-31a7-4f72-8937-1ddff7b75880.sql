GRANT EXECUTE ON FUNCTION public.qm_create_incident(text, text, uuid, uuid, public.incident_severity) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qm_assign_incident(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qm_set_state(uuid, public.incident_state, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qm_resolve_incident(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qm_sweep_sla() TO authenticated;

REVOKE ALL ON FUNCTION public.qm_create_incident(text, text, uuid, uuid, public.incident_severity) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.qm_assign_incident(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.qm_set_state(uuid, public.incident_state, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.qm_resolve_incident(uuid, text, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.qm_sweep_sla() FROM anon, PUBLIC;