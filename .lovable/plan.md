## Goal
Hide the unfinished Contact Center functionality behind a professional Coming Soon page for the Pilot/Go Live release, without deleting any existing code or changing engines.

## Approach
1. **Preserve existing implementation**
   - Move the full `src/routes/contact-center.tsx` page implementation to `src/components/contact-center/contact-center-full.tsx` as a regular component export.
   - Keep all helper components, types, hooks, and logic intact; only remove TanStack route-specific boilerplate from the moved file.

2. **Create the Coming Soon component**
   - Add `src/components/contact-center/contact-center-coming-soon.tsx`.
   - Use the existing design system: `Card`, `CardContent`, standard typography, semantic colors (`text-primary`, `text-muted-foreground`, `bg-muted`, `border-border`), and the `Headphones` icon from `lucide-react`.
   - Render a centered card with:
     - Title: "Contact Center Operations"
     - Subtitle: "Coming Soon"
     - Body: "This module will be available in a future release."

3. **Update the route file**
   - Replace `src/routes/contact-center.tsx` with a thin route wrapper that imports `ContactCenterComingSoon` and renders it inside the existing app layout.
   - Keep the route's `head()` metadata.

4. **Verify**
   - Run typecheck/build to confirm no unused-import errors and that the route still registers correctly.
   - Confirm the sidebar "Contact Center" entry opens the Coming Soon page and that the layout, sidebar, and header remain unchanged.

## Out of Scope
- No changes to Workflow, Notification, Timeline, Audit, Delivery, Passenger, RBAC, or database logic.
- No sidebar removal or renaming.
- No deletion of existing Contact Center code.