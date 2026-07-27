import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { driverPool } from "@/lib/store";

export interface DeliveryAgent {
  id: string;
  full_name: string;
  employee_id: string;
  station: string;
}

/**
 * Live delivery agent directory sourced from Administration (`app_users`).
 * Falls back to the seeded pool only while the directory is empty.
 */
export function useDeliveryAgents(): { agents: DeliveryAgent[]; names: string[] } {
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("list_delivery_agents").then(({ data }) => {
      if (cancelled || !data) return;
      setAgents(data as DeliveryAgent[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const names = agents.length > 0 ? agents.map((a) => a.full_name) : [...driverPool];
  return { agents, names };
}