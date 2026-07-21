import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { PirReport } from "@/components/lost-found/pir-report";

export const Route = createFileRoute("/print/pir")({
  validateSearch: (search: Record<string, unknown>): { ids: string } => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  head: () => ({
    meta: [
      { title: "PIR Report — IAB" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintPirPage,
});

function PrintPirPage() {
  const { ids } = Route.useSearch();
  const cases = useStore((s) => s.cases);
  const printedRef = useRef(false);

  const requestedIds = useMemo(
    () =>
      ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [ids],
  );

  const matched = useMemo(
    () =>
      requestedIds
        .map((id) => cases.find((c) => c.bagId === id || c.pirNumber === id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [requestedIds, cases],
  );

  useEffect(() => {
    if (printedRef.current) return;
    if (requestedIds.length === 0) return;
    if (matched.length !== requestedIds.length) return;
    printedRef.current = true;
    // Give the browser a tick to paint fonts/layout before opening the dialog.
    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [matched, requestedIds]);

  if (requestedIds.length === 0) {
    return (
      <div className="pir-shell">
        <p className="pir-empty">No PIR selected for printing.</p>
      </div>
    );
  }

  if (matched.length !== requestedIds.length && matched.length === 0) {
    return (
      <div className="pir-shell">
        <p className="pir-empty">Loading PIR report…</p>
      </div>
    );
  }

  return (
    <div className="pir-shell">
      {matched.map((c, i) => (
        <div key={c.bagId} className={i < matched.length - 1 ? "pir-page-break" : ""}>
          <PirReport caseRecord={c} />
        </div>
      ))}
    </div>
  );
}
