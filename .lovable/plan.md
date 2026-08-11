# Fix: app crashes after login

## What broke
The mobile header logo button added in the last change crashes every authenticated page.

The header uses the shared sidebar trigger in "asChild" mode with the logo tile inside it. That trigger component always renders its own icon and a hidden label in addition to whatever is passed in, and "asChild" mode only accepts a single child. React throws:

`React.Children.only expected to receive a single React element child.`

Because the header renders on every signed-in page, the whole app falls into the error screen right after login. Public pages (sign-in, passenger portal) don't render the header, which is why login itself works.

## The fix (one file, a few lines)
In `src/components/app-shell.tsx`, replace the `SidebarTrigger asChild` wrapper around the mobile logo with a plain `<button>` that calls `toggleSidebar()` from the existing `useSidebar()` hook. Same markup, same classes, same logo tile, same aria-label — only the wrapping component changes.

Nothing else is touched: no other mobile styles, sidebar, filters, desktop layout, backend, workflows, routing, or auth.

## Verification
- Sign in and confirm the dashboard renders instead of the error screen.
- Confirm the mobile logo still opens the navigation drawer.
- Confirm the desktop layout and sidebar are unchanged.
