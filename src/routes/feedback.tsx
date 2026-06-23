import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, addFeedback } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Smile } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Smart Baggage Ecosystem" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const closedCases = useStore((s) => s.cases.filter((c) => c.status === "Delivered"));
  const feedback = useStore((s) => s.feedback);
  const [bagId, setBagId] = useState(closedCases[0]?.bagId ?? "");
  const [resolved, setResolved] = useState<"yes" | "no">("yes");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");

  const avg = feedback.length ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : 0;
  const yes = feedback.filter((f) => f.resolved).length;
  const total = feedback.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = closedCases.find((x) => x.bagId === bagId);
    if (!c) {
      toast.error("Select a delivered bag");
      return;
    }
    addFeedback({
      bagId: c.bagId,
      passengerName: c.passengerName,
      resolved: resolved === "yes",
      rating,
      comments,
    });
    toast.success("Feedback recorded");
    setComments("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customer Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Closed-case satisfaction survey and daily feedback report.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Avg Rating" value={`${avg.toFixed(1)}/5`} />
        <Kpi label="Total Responses" value={total} />
        <Kpi label="Issue Resolved" value={`${total ? Math.round((yes / total) * 100) : 0}%`} />
        <Kpi label="Today" value={feedback.filter((f) => new Date(f.at).toDateString() === new Date().toDateString()).length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bag</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={bagId}
                  onChange={(e) => setBagId(e.target.value)}
                >
                  {closedCases.length === 0 && <option value="">No delivered bags</option>}
                  {closedCases.map((c) => (
                    <option key={c.bagId} value={c.bagId}>
                      {c.bagId} · {c.passengerName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Was your issue resolved?</Label>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setResolved(v)}
                      className={`flex-1 h-9 rounded-md border text-sm capitalize ${
                        resolved === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Satisfaction Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className={`h-7 w-7 ${
                          n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Comments</Label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Tell us about your experience…"
                  rows={4}
                  maxLength={500}
                />
              </div>
              <Button type="submit" className="w-full">Submit Feedback</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Feedback Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedback.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No feedback yet.</p>
            )}
            {feedback.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{f.passengerName}</p>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {f.bagId} · {new Date(f.at).toLocaleString()}
                </p>
                <p className="text-sm mt-2">{f.comments}</p>
                <p className="text-[11px] mt-1">
                  Resolved:{" "}
                  <span className={f.resolved ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                    {f.resolved ? "Yes" : "No"}
                  </span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Smile className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}