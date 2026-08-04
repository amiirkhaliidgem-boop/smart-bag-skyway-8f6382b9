import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useStore, type BaggageCase } from "@/lib/store";
import { PirReport } from "./pir-report";

type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

export const pirPrintBus = {
  print(ids: string[]) {
    if (!ids || ids.length === 0) return;
    for (const l of listeners) l(ids);
  },
};

export function PirPrintHost() {
  const cases = useStore((s) => s.cases);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setIds(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const matched: BaggageCase[] = ids
    .map((id) => cases.find((c) => c.bagId === id || c.pirNumber === id))
    .filter((c): c is BaggageCase => !!c);

  useEffect(() => {
    if (ids.length === 0) return;
    const missing = ids.length - matched.length;
    if (missing > 0 && matched.length === 0) {
      toast.error("PIR case not found for printing.");
      setIds([]);
    } else if (missing > 0) {
      toast.warning(`${missing} case(s) not found — printing the rest.`);
    }
  }, [ids, matched.length]);

  useLayoutEffect(() => {
    if (matched.length === 0) return;
    const cleanup = () => setIds([]);
    window.addEventListener("afterprint", cleanup);
    const raf = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          window.print();
        } finally {
          // Safety net in case afterprint doesn't fire (some browsers).
          window.setTimeout(cleanup, 500);
        }
      }, 0);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", cleanup);
    };
  }, [matched.length]);

  if (matched.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div className="pir-print-portal" aria-hidden="true">
      <div className="pir-shell">
        {matched.map((c, i) => (
          <div key={c.bagId} className={i < matched.length - 1 ? "pir-page-break" : ""}>
            <PirReport caseRecord={c} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
