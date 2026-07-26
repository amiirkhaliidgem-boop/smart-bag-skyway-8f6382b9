## Root cause (verified)

In `src/routes/tracking.tsx` (lines 151-160) the result header renders two badges:

1. `<StatusBadge status={kase.status} />` — the Lost & Found **case status** (`src/components/status-badge.tsx` prints the raw value, e.g. `Delivered`).
2. A pill using `STAGE_LABELS[stage]` — the Delivery Management **stage** (`src/lib/delivery/stages.ts`, where `Delivered: "Delivered"`).

Two different models rendered side by side, which operationally represent the same business state — hence "Delivered Delivered".

## Fix (UI only, `src/routes/tracking.tsx`)

- Render exactly **one** operational status badge in the result header.
- The **Delivery Stage** is the primary status: whenever a delivery stage is resolved, show only the stage pill (`STAGE_LABELS[stage]` with `STAGE_STYLES[stage]`) and do not render the case-status badge at all.
- Only when there is no delivery/stage yet (case not handed over) fall back to the L&F case badge, so the header is never empty.
- Everything else stays: the "Latest Workflow Status" tile, the delivery progress stepper, OTP card and timeline are untouched.

No changes to the Workflow Engine, Delivery Engine, Timeline, Notifications, Audit, database, or `src/lib/tracking/resolve.ts`.
