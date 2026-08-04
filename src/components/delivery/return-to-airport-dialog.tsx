import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RETURN_REASONS, type ReturnReasonCode } from "@/lib/delivery/stages";

/**
 * Single dialog used by the Dispatch Center bulk toolbar and the Delivery
 * Details console, for both outcomes that need a reason: "Return to Airport"
 * and "Mark Delivery Failed". It only collects the reason; the caller pushes
 * the transition through the Workflow Engine.
 */
export function ReturnToAirportDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  variant = "return",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onConfirm: (reasonCode: ReturnReasonCode, note: string) => Promise<void> | void;
  variant?: "return" | "failed";
}) {
  const [reason, setReason] = useState<ReturnReasonCode>(RETURN_REASONS[0].code);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const failed = variant === "failed";
  const title = failed ? "Mark Delivery Failed" : "Return to Airport";
  const description = failed
    ? "The attempt is recorded against this delivery, the one-time code is cancelled and a quality incident is raised. The case waits at Delivery Failed until it is rescheduled or returned to the airport."
    : count === 1
      ? "The delivery agent assignment is cleared and the case returns to Ready for Delivery."
      : `${count} deliveries will be unassigned and returned to the Ready for Delivery queue.`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onConfirm(reason, note.trim());
      setNote("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <UISelect value={reason} onValueChange={(v) => setReason(v as ReturnReasonCode)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </UISelect>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for the audit trail…"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant={failed ? "destructive" : "default"} disabled={busy}>
              {busy ? "Saving…" : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
