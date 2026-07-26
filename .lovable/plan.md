## Current state (verified)

- `src/routes/feedback.tsx` holds the whole dashboard inline (`FeedbackPage`, `Stars`, `Kpi`) at route `/feedback`.
- The sidebar (`src/components/app-shell.tsx`) lists "Customer Feedback" only under **CONTACT CENTER OPERATIONS**.
- `src/lib/rbac.ts` restricts `/feedback` to `admin` only, while `/tracking` (the shared-module precedent) allows `admin`, `agent`, `coordinator`.
- Baggage Tracking's pattern: logic lives in `src/components/tracking/track-baggage.tsx`, and `src/routes/tracking.tsx` is a thin route wrapper listed in two sidebar sections.

## Changes

### 1. Mirror the Baggage Tracking structure
- Move the dashboard body into `src/components/feedback/feedback-dashboard.tsx`, exporting `FeedbackDashboard` (includes the `Stars` and `Kpi` helpers).
- `src/routes/feedback.tsx` keeps its route definition and `head()` metadata and simply renders `<FeedbackDashboard />`.
- No second route, no duplicated UI.

### 2. Add the Lost & Found access point
- In `src/components/app-shell.tsx`, add a "Customer Feedback" item pointing to `/feedback` in the **Baggage Operations** section, alongside the existing Contact Center entry. Both link to the same route.

### 3. Widen access
- In `src/lib/rbac.ts`, change the `/feedback` rule to allow `admin` and `agent` (Lost & Found officers), matching how `/tracking` was widened.

## Not touched
- Workflow / Delivery / Notification / Timeline / Audit engines
- Database schema and the Passenger Portal feedback collection flow
- Feedback filters, KPIs, table, or export behaviour
