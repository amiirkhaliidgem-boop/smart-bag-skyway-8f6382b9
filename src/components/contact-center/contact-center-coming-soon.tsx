import { Headphones } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ContactCenterComingSoon() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contact Center Operations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unified view of inbound calls, WhatsApp conversations, and passenger follow-ups.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 sm:p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-6">
              <Headphones className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Coming Soon</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              This module will be available in a future release.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
