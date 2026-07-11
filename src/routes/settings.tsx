import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "System Settings — IAB Smart Baggage Ecosystem" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const save = () => toast.success("Settings saved", { description: "Configuration updated across all portals." });
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground">Global configuration for the Smart Baggage Ecosystem.</p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="sms">SMS Templates</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Templates</TabsTrigger>
          <TabsTrigger value="notifications">Notification Rules</TabsTrigger>
          <TabsTrigger value="workflow">Workflow Rules</TabsTrigger>
          <TabsTrigger value="otp">OTP</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="airport">Airport</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Name" defaultValue="International Aviation Business (IAB)" />
              <Field label="Time Zone" defaultValue="Africa/Cairo (GMT+2)" />
              <Field label="Default Currency" defaultValue="EGP" />
              <Field label="Business Hours" defaultValue="24/7 Operations" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Supported Languages</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="English (en)" defaultChecked />
              <ToggleRow label="Arabic (ar)" defaultChecked />
              <ToggleRow label="French (fr)" />
              <ToggleRow label="German (de)" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">SMS Templates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <TemplateField label="Delivery Approved (EN)" defaultValue="Dear {{PassengerName}}, your baggage delivery has been approved. Track: {{TrackingLink}}" />
              <TemplateField label="Out for Delivery (AR)" defaultValue="أمتعتك الآن خرجت للتوصيل. يمكنك متابعة الرحلة: {{TrackingLink}}" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">WhatsApp Templates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <TemplateField label="Driver Assigned (EN)" defaultValue="Hello {{PassengerName}}, driver {{DriverName}} has been assigned to your delivery. ETA: {{ETA}}." />
              <TemplateField label="OTP Requested (EN)" defaultValue="Your delivery verification code is {{OTP}}. Do not share this code." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Notification Rules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Auto-send SMS on 'Delivery Approved'" defaultChecked />
              <ToggleRow label="Auto-send WhatsApp on 'Out for Delivery'" defaultChecked />
              <ToggleRow label="Email tracking link when case opened" defaultChecked />
              <ToggleRow label="Push notification via Driver App" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Workflow Rules</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Max SLA for Out for Delivery (min)" defaultValue="120" />
              <Field label="Auto-close Delivered after (hrs)" defaultValue="48" />
              <Field label="Escalation supervisor" defaultValue="Ops Supervisor CAI" />
              <Field label="Retry OTP attempts" defaultValue="3" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="otp" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">OTP Configuration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="OTP Length" defaultValue="6" />
              <Field label="OTP Expiry (minutes)" defaultValue="10" />
              <Field label="Channel" defaultValue="SMS + WhatsApp" />
              <Field label="Provider" defaultValue="Pending Integration" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={iabLogo.url} alt="IAB" className="h-16 w-16 rounded-lg bg-white ring-1 ring-border p-1 object-contain" />
                <div>
                  <p className="font-medium">IAB Corporate Logo</p>
                  <p className="text-xs text-muted-foreground">Used across all portals and passenger communications.</p>
                </div>
              </div>
              <Field label="Primary Brand Color" defaultValue="#0F4C81" />
              <Field label="Accent Color" defaultValue="#F5A623" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="airport" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Airport Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Primary Station" defaultValue="Cairo International Airport (CAI)" />
              <Field label="Terminals" defaultValue="TB1, TB2, TB3" />
              <Field label="Ground Handling Provider" defaultValue="IAB Ground Services" />
              <Field label="Operations Contact" defaultValue="+20 2 2265 0000" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save}>Save Configuration</Button>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input defaultValue={defaultValue} />
    </div>
  );
}

function TemplateField({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Textarea defaultValue={defaultValue} rows={3} />
    </div>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium">{label}</p>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}