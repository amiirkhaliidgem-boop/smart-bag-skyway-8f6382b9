-- Cases
DROP POLICY IF EXISTS "ops staff read cases" ON public.baggage_cases;
DROP POLICY IF EXISTS "agents read linked cases" ON public.baggage_cases;
CREATE POLICY "read cases" ON public.baggage_cases FOR SELECT TO authenticated
USING (
  (SELECT public.is_ops_staff(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.deliveries d
             WHERE d.case_id = baggage_cases.id
               AND d.assigned_agent_id = (SELECT public.current_app_user_id()))
);

-- Case bags
DROP POLICY IF EXISTS "ops staff read case bags" ON public.case_bags;
DROP POLICY IF EXISTS "agents read linked case bags" ON public.case_bags;
CREATE POLICY "read case bags" ON public.case_bags FOR SELECT TO authenticated
USING (
  (SELECT public.is_ops_staff(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.deliveries d
             WHERE d.case_id = case_bags.case_id
               AND d.assigned_agent_id = (SELECT public.current_app_user_id()))
);

-- Deliveries
DROP POLICY IF EXISTS "ops staff read deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "agents read own deliveries" ON public.deliveries;
CREATE POLICY "read deliveries" ON public.deliveries FOR SELECT TO authenticated
USING (
  (SELECT public.is_ops_staff(auth.uid()))
  OR (assigned_agent_id IS NOT NULL AND assigned_agent_id = (SELECT public.current_app_user_id()))
);

-- Workflow events
DROP POLICY IF EXISTS "ops staff read workflow events" ON public.workflow_events;
DROP POLICY IF EXISTS "agents read own workflow events" ON public.workflow_events;
CREATE POLICY "read workflow events" ON public.workflow_events FOR SELECT TO authenticated
USING (
  (SELECT public.is_ops_staff(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.deliveries d
             WHERE d.id = workflow_events.delivery_id
               AND d.assigned_agent_id = (SELECT public.current_app_user_id()))
);

-- Single-predicate ops tables: hoist the check into an initplan
DROP POLICY IF EXISTS "ops staff read delivery notes" ON public.delivery_notes;
CREATE POLICY "ops staff read delivery notes" ON public.delivery_notes FOR SELECT TO authenticated
USING ((SELECT public.is_ops_staff(auth.uid())));

DROP POLICY IF EXISTS "ops staff read passenger links" ON public.passenger_links;
CREATE POLICY "ops staff read passenger links" ON public.passenger_links FOR SELECT TO authenticated
USING ((SELECT public.is_ops_staff(auth.uid())));

DROP POLICY IF EXISTS "ops staff read timeline" ON public.timeline_events;
CREATE POLICY "ops staff read timeline" ON public.timeline_events FOR SELECT TO authenticated
USING ((SELECT public.is_ops_staff(auth.uid())));

DROP POLICY IF EXISTS "ops staff read audit" ON public.audit_events;
CREATE POLICY "ops staff read audit" ON public.audit_events FOR SELECT TO authenticated
USING ((SELECT public.is_ops_staff(auth.uid())));

DROP POLICY IF EXISTS "ops staff read notifications" ON public.notification_events;
CREATE POLICY "ops staff read notifications" ON public.notification_events FOR SELECT TO authenticated
USING ((SELECT public.is_ops_staff(auth.uid())));

DROP POLICY IF EXISTS "admins read otp" ON public.otp_challenges;
CREATE POLICY "admins read otp" ON public.otp_challenges FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)));

CREATE INDEX IF NOT EXISTS deliveries_assigned_agent_idx
  ON public.deliveries (assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
