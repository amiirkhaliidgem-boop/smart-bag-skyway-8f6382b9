import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useStore, type Delivery, type BaggageCase, type WorkflowRecord } from "@/lib/store";
import { PodReport } from "./pod-report";

type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

export const podPrintBus = {
  print(ids: string[]) {
    if (!ids || ids.length === 0) return;
    for (const l of listeners) l(ids);
  },
};

function firstTimeAt(wf: WorkflowRecord | undefined, needle: string): string | undefined {
  if (!wf) return undefined;
  const hit = wf.history.find((h) => h.status === (needle as WorkflowRecord["status"]));
  return hit?.at;
}

export function PodPrintHost() {
  const deliveries = useStore((s) => s.deliveries);
  const cases = useStore((s) => s.cases);
  const workflow = useStore((s) => s.workflow);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setIds(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const matched: Delivery[] = ids
    .map((id) => deliveries.find((d) => d.deliveryId === id))
    .filter((d): d is Delivery => !!d);

  useEffect(() => {
    if (ids.length === 0) return;
    const missing = ids.length - matched.length;
    if (missing > 0 && matched.length === 0) {
      toast.error("Delivery not found for printing.");
      setIds([]);
    } else if (missing > 0) {
      toast.warning(`${missing} delivery(ies) not found — printing the rest.`);
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

  const findCase = (bagId: string): BaggageCase | undefined =>
    cases.find((c) => c.bagId === bagId);
  const findWorkflow = (deliveryId: string): WorkflowRecord | undefined =>
    workflow.find((w) => w.deliveryId === deliveryId);

  return createPortal(
    <div className="pir-print-portal" aria-hidden="true">
      <div className="pir-shell">
        {matched.map((d, i) => {
          const wf = findWorkflow(d.deliveryId);
          return (
            <div
              key={d.deliveryId}
              className={i < matched.length - 1 ? "pir-page-break" : ""}
            >
              <PodReport
                delivery={d}
                caseRecord={findCase(d.bagId)}
                assignedAt={firstTimeAt(wf, "Driver Assigned")}
                outForDeliveryAt={firstTimeAt(wf, "Out For Delivery")}
              />
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}