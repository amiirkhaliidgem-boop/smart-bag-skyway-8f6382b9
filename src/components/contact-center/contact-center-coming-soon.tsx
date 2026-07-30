import { Headphones } from "lucide-react";
import { ModuleComingSoon } from "@/components/module-coming-soon";

export function ContactCenterComingSoon() {
  return (
    <ModuleComingSoon
      title="Contact Center Operations"
      subtitle="Unified view of inbound calls, WhatsApp conversations, and passenger follow-ups."
      icon={Headphones}
    />
  );
}
