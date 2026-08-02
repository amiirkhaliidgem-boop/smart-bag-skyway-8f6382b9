import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadSystemSettings, getPublicSettings } from "@/lib/settings.functions";
import { DEFAULT_CONTACTS, DEFAULT_GENERAL, type SystemSettingsBundle } from "./types";

export const SETTINGS_QUERY_KEY = ["system-settings"] as const;
export const PUBLIC_SETTINGS_QUERY_KEY = ["public-settings"] as const;

export const systemSettingsQuery = queryOptions({
  queryKey: SETTINGS_QUERY_KEY,
  queryFn: () => loadSystemSettings(),
  staleTime: 30_000,
});

export const publicSettingsQuery = queryOptions({
  queryKey: PUBLIC_SETTINGS_QUERY_KEY,
  queryFn: () => getPublicSettings(),
  staleTime: 60_000,
});

const EMPTY: SystemSettingsBundle = {
  general: DEFAULT_GENERAL,
  contacts: DEFAULT_CONTACTS,
  sla: { lf_sla_hours: 24 },
  regions: [],
  templates: [],
  canManage: false,
};

/**
 * Live System Settings for signed-in staff. A change made by an
 * administrator propagates to every open screen through Realtime.
 */
export function useSystemSettings() {
  const qc = useQueryClient();
  const query = useQuery(systemSettingsQuery);

  useEffect(() => {
    const channel = supabase
      .channel("system-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () =>
        qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "sla_regions" }, () =>
        qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_templates" },
        () => qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return {
    settings: query.data ?? EMPTY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh: () => qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
  };
}

/** Read-only settings for public surfaces (Passenger Portal, tracking page). */
export function usePublicSettings() {
  const query = useQuery(publicSettingsQuery);
  return query.data ?? null;
}