Update only the PIR Report Template layout to meet the following requirements:

1. Logo Position
   - Add the existing IAB logo (`/src/assets/iab-logo.jpeg`) to the top-left corner of the report header.
   - Reorder the header so the logo sits on the left, the title/subtitle sits in the center/remaining space, and the case meta stays on the right.
   - Keep the logo small and aligned with the report title (max height ~28–32 px).

2. Remove Case Lifecycle
   - Delete the entire "Case Lifecycle" section from `src/components/lost-found/pir-report.tsx`.
   - Remove the related `LF_STATUS_ORDER` import and lifecycle styling in `src/styles.css`.

3. Remove Description / Notes
   - Delete the conditional "Description / Notes" section from the report.
   - Remove the associated `.pir-description` CSS rules.

4. Remove Time Values
   - Change the `fmtDate` helper to output `dd/MM/yyyy` only (no hour/minute).
   - Apply consistently across the report: Created, Last Updated, Generated, and any other date fields.

Files to edit:
- `src/components/lost-found/pir-report.tsx`
- `src/styles.css`

No database changes, no new routes, no business-logic changes.