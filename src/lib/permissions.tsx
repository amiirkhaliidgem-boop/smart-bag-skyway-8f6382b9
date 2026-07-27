import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { moduleForPath, ROUTE_MODULES, type RbacAction, type RbacModule } from "@/lib/admin/modules";

export interface PermissionState {
  /** "Module|Action" pairs granted to the signed-in user. */
  granted: Set<string>;
  loading: boolean;
  /** True when the user has no live RBAC record (fall back to legacy role gating). */
  unmanaged: boolean;
}

export const PermissionContext = createContext<PermissionState>({
  granted: new Set(),
  loading: true,
  unmanaged: true,
});

export function usePermissions() {
  const state = useContext(PermissionContext);
  return useMemo(
    () => ({
      ...state,
      can(module: RbacModule | string, action: RbacAction | string = "View") {
        return state.granted.has(`${module}|${action}`);
      },
      canAccess(pathname: string) {
        const mod = moduleForPath(pathname);
        if (!mod) return false;
        return state.granted.has(`${mod}|View`);
      },
    }),
    [state],
  );
}

export function useLivePermissions(userId: string | null | undefined): PermissionState {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [unmanaged, setUnmanaged] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setGranted(new Set());
      setUnmanaged(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("current_user_permissions");
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setGranted(new Set());
        setUnmanaged(true);
      } else {
        setGranted(new Set(data.map((r) => `${r.module}|${r.action}`)));
        setUnmanaged(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { granted, loading, unmanaged };
}

/** First landing route the user is allowed to see. */
export function firstAllowedPath(granted: Set<string>): string {
  const rule = ROUTE_MODULES.find((r) => granted.has(`${r.module}|View`));
  return rule?.prefix ?? "/auth";
}