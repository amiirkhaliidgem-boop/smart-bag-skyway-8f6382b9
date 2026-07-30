## Answers first (verified against the code and database)

### 1. Why "admin" appears as an agent

The agent list is not built from the role query alone. In `src/routes/agent-monitoring.tsx` the roster is a **union of three sources**:

1. `list_delivery_agents()` — this one *is* correct: it returns only `app_users` with `user_type = 'driver'` and `status = 'Active'`.
2. every distinct `driver` name found on deliveries,
3. **every key in `driverPositions`** — i.e. anyone with a row in `agent_positions`.

The database confirms source 3 is the leak:

```text
agent_positions rows
  admin          user_type = staff   (role: administrator)  30.02625, 31.01460  07:43
  Ahmed Mostafa  user_type = driver  (role: delivery_agent) 30.02634, 31.01474  08:09
```

So `admin` has a stored GPS row (the admin account opened the Driver Portal at some point and the geolocation watcher posted a position), and the union pulls that name into the monitoring screen.

Related data note: the seeded user named `driver` has role `delivery_agent` but `user_type = 'staff'`, so it is currently *excluded* by `list_delivery_agents()`. Role and user_type disagree in the directory.

### 2. Live GPS — honest status

It is **real browser geolocation from the Driver Portal, persisted in Postgres, and read back as last-known position** — not static demo coordinates, and not a live stream.

- `src/routes/driver-portal.tsx` calls `navigator.geolocation.getCurrentPosition` + `watchPosition` while a driver has the portal open.
- Each update calls `agent_report_position(lat, lng, accuracy)`, which upserts one row per agent in `agent_positions` and recomputes the route.
- Monitoring reads `agent_positions` in the secondary snapshot and re-polls every 15s.

Therefore: coordinates are genuine, but only as fresh as the last time that driver had the portal open in the foreground. If the portal is closed, the card keeps showing the last stored fix (the "Offline"/"x min ago" label is the only signal). Calling it "Live" without qualification is overstated.

## Plan

### A. Roster: delivery agents only
1. Update the `list_delivery_agents()` function to return users who are **delivery agents by role** — `user_role_assignments` → `app_roles.key = 'delivery_agent'` (optionally OR `user_type = 'driver'`), `status = 'Active'` — so role and user_type disagreement can't hide or expose the wrong people.
2. In `src/routes/agent-monitoring.tsx`, stop unioning arbitrary names. Build the roster **strictly from `list_delivery_agents()`**; use delivery `driver` names and `driverPositions` keys only to *enrich* those agents, never to add new ones.
3. Same filter applies to the agent dropdown, the monitored-delivery set and the activity timeline, so admin/officer/coordinator data can never surface here.

### B. Honest GPS labelling (presentation only)
4. Replace the blanket "Live · auto-refresh" chip with "Auto-refresh · every 15s".
5. On each card, label the block "Last known GPS position" and show freshness explicitly: `Live (updated <2 min)` when fresh, otherwise `Last fix 07:43 · 26 min ago (portal closed)`.

### Technical details
- One migration replacing `public.list_delivery_agents()` (security definer, same signature and grants).
- Frontend edits confined to `src/routes/agent-monitoring.tsx`.
- No change to the Driver Portal, `agent_report_position`, the Workflow Engine, or any stored data. Optionally, the stale `admin` row in `agent_positions` can be deleted; say the word and I'll include it.
