# Passenger Portal auto-update via anon-RPC polling

## Goal
Passenger Portal reflects workflow changes without manual reload, while keeping the current public architecture: anonymous `get_passenger_view(token)` RPC, no Realtime, no Zustand, no `app_state`, no authenticated dependency.

## Approach
Replace the one-shot route loader read with a TanStack Query subscription that re-invokes the same server function on an interval. The server function still calls only `rpc.get_passenger_view` with the publishable key. No new data paths, no new tables, no new SDK usage.

## Changes (files only, no code yet)

1. `src/routes/passenger.$token.tsx`
   - Loader keeps priming the cache via `context.queryClient.ensureQueryData(passengerViewQuery(token))` so the first paint stays SSR/loader-driven and flicker-free.
   - Component switches from `Route.useLoaderData()` to `useSuspenseQuery(passengerViewQuery(token))`.
   - `queryFn` calls the existing `getPassengerViewByToken({ data: { token } })` — unchanged server function, unchanged RPC.
   - `refetchInterval`: 5000 ms while the delivery is active. Returns `false` (stops polling) once `view.stage` is terminal — `Delivered`, `Failed`, `Returned to Airport` — or `view.found === false`.
   - `refetchIntervalInBackground: false` so hidden tabs don't poll.
   - `refetchOnWindowFocus: true` so returning to the tab triggers an immediate refresh.
   - `staleTime: 0`, `gcTime` short. No manual `setInterval`, no `router.invalidate` loop.
   - `TokenNotFound` / `TokenLoading` behavior preserved.

2. `src/lib/passenger.functions.ts`
   - No functional change. Only export a small `passengerViewQuery(token)` `queryOptions` factory (co-located or in a new `src/lib/passenger.queries.ts`) so loader and component share one key: `["passenger-view", token]`.

3. Router config (`src/router.tsx`)
   - Confirm `defaultPreloadStaleTime: 0` (required so Query, not the router, owns freshness). No change if already set.

## Explicitly NOT doing
- No Supabase Realtime channel, no `postgres_changes` subscription, no changes to the `supabase_realtime` publication.
- No Zustand rehydration on the passenger path.
- No reads of `app_state`, no service-role key, no authenticated Supabase client.
- No change to the four public RPCs, the sync trigger, or the helper tables.
- No new anon grants.
- Mutation server functions (`passenger_confirm_delivery`, `passenger_submit_feedback`, `passenger_report_misconduct`) stay as-is; after each mutation the component calls `queryClient.invalidateQueries(["passenger-view", token])` so the UI updates immediately without waiting for the next poll tick.

## Polling policy
- Interval: 5 s.
- Stop conditions: `stage ∈ { Delivered, Failed, Returned to Airport }` or RPC returns not-found.
- Background tabs: paused.
- Focus: immediate refetch on tab focus.
- Bandwidth: RPC returns a single small JSON object (~200 bytes); 12 req/min per open portal, zero once terminal.

## Verification
- Open a passenger link, transition the delivery from staff UI, confirm portal status updates within ~5 s with no reload, on desktop and mobile, in preview and published.
- Advance to `Delivered`; confirm polling stops (network tab shows no further RPC calls).
- Hide the tab; confirm no requests. Refocus; confirm one immediate request.
- Invalid token still renders `TokenNotFound` and does not poll.
