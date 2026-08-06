import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeRealtime } from "@/lib/realtime";
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
  staleTime: 0,
  // Public (anon) surfaces cannot join the authenticated realtime hub, and
  // settings change very rarely — a focus-driven refetch plus a slow poll is
  // equivalent in freshness at a fraction of the traffic.
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
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

  // Every mounted consumer shares one hub registration, so five hooks no
  // longer open five channels. Only settings tables are bound here, so an
  // operational write never invalidates the settings cache.
  useEffect(
    () =>
      subscribeRealtime(
        ["system_settings", "sla_regions", "notification_templates"],
        (table) => {
          void qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
          if (table === "system_settings") {
            void qc.invalidateQueries({ queryKey: PUBLIC_SETTINGS_QUERY_KEY });
          }
        },
      ),
    [qc],
  );

  return {
    settings: query.data ?? EMPTY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: PUBLIC_SETTINGS_QUERY_KEY }),
      ]),
  };
}

/** Read-only settings for public surfaces (Passenger Portal, tracking page). */
export function usePublicSettings() {
  const query = useQuery(publicSettingsQuery);
  return query.data ?? null;
}