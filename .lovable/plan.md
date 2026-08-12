# UAT Fix — Delivery Agent Assignment + "All dates" Filter

## Issue 1 — "No active Delivery Agent record"

### Root cause (verified)
The operational snapshot loads its staff directory through `ops_core_rows`, which is SECURITY INVOKER. The `app_users` table only has these read policies:

- read own record, or
- administrator

So for any non-admin (e.g. the Lost & Found Dispatcher) the snapshot's `users` list comes back with only their own row. That directory is what builds the internal name → agent-id map used when assigning, and also what resolves the "Delivery Agent" name shown on a delivery. Result: the agent dropdown is populated (it uses the SECURITY DEFINER `list_delivery_agents`), but the assignment can't resolve the agent's record and is rejected — and delivery records show "Unassigned" even after a successful assignment.

The agent records themselves are fine: both delivery agents in the database are `Active` with the `delivery_agent` role.

### Fix
1. Migration: add a SECURITY DEFINER directory function that returns only the non-sensitive staff columns already used by the snapshot (id, full name, employee id, user type, status), granted to authenticated users. Update `ops_core_rows` to read the `users` block through it. No table, RLS policy, role or permission changes — the sensitive columns (PIN hash/salt, contacts) stay unreadable.
2. Client safety net in `src/lib/store.ts`: if the agent id can't be resolved locally at assign time, resolve it once through the existing `list_delivery_agents` RPC before calling `dm_assign_agent`. No parallel assignment path — the same Workflow Engine RPC is still what performs the transition.

This keeps only-active-agents-assignable behaviour, the Delivery Agent Portal, RBAC and permissions untouched.

## Issue 2 — "All dates" → Invalid time value

### Root cause (verified)
"All dates" clears the From/To values to empty strings. Executive Dashboard and Reports then build their query with `new Date(\`${from}T00:00:00.000Z\`).toISOString()`, which on an empty string is an Invalid Date and `toISOString()` throws "Invalid time value" — the query fails before it reaches the server.

### Fix
Add one shared helper in `src/components/filters/date-range-filter.tsx` that converts the filter state into the ISO bounds the analytics functions expect, treating an empty value as unbounded (open lower bound = epoch, open upper bound = end of today). Executive Dashboard (`src/routes/index.tsx`) and Reports (`src/routes/reports.tsx`) call that helper instead of constructing dates inline. Today / 7 days / 30 days and custom From/To keep the exact same bounds they produce now.

No other module builds dates from the filter this way, so the shared helper stays the single implementation.

## Files changed
- Supabase migration (staff directory function + `ops_core_rows` users block)
- `src/lib/store.ts`
- `src/components/filters/date-range-filter.tsx`
- `src/routes/index.tsx`
- `src/routes/reports.tsx`

## Verification
- Query the snapshot RPC as a non-admin role and confirm the delivery agents are present.
- Assign an agent to a delivery and confirm the delivery row, timeline and audit reflect the assignment.
- Executive Dashboard and Reports: All dates, Today, 7 days, 30 days and a custom range each load without error.
- Confirm no UI/desktop/mobile styling, routing or navigation changes.

Then republish so the public link serves the fix.
