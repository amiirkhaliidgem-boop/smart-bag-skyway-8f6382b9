import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffOfficer {
  id: string;
  full_name: string;
  employee_id: string;
  department: string;
}

/**
 * Live Lost & Found officer directory sourced from Administration
 * (`app_users`, non-agent active staff). Used by "Assign Officer".
 */
export function useStaffOfficers(): StaffOfficer[] {
  const [officers, setOfficers] = useState<StaffOfficer[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (supabase.rpc as any)("list_staff_officers").then(({ data }: { data: unknown }) => {
      if (cancelled || !data) return;
      setOfficers(data as StaffOfficer[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return officers;
}