import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agent" | "coordinator" | "driver";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Airport Administrator",
  agent: "Lost & Found Officer",
  coordinator: "Delivery Coordinator",
  driver: "Delivery Agent",
};

// Route → roles allowed (admin is ALWAYS allowed and is added implicitly).
// Order matters: first match wins. Use prefix matching.
const RULES: { prefix: string; exact?: boolean; roles: AppRole[] }[] = [
  { prefix: "/", exact: true, roles: ["admin", "agent", "coordinator"] },
  { prefix: "/lost-found", roles: ["admin", "agent"] },
  { prefix: "/storage", roles: ["admin", "agent"] },
  { prefix: "/qr-scan", roles: ["admin", "agent"] },
  { prefix: "/reports", roles: ["admin", "agent"] },
  { prefix: "/data-io", roles: ["admin", "agent"] },
  { prefix: "/delivery", roles: ["admin", "coordinator"] },
  { prefix: "/driver-portal", roles: ["admin", "driver"] },
  // Shared operational surface: opened from Baggage Operations and Contact Center.
  { prefix: "/tracking", roles: ["admin", "agent", "coordinator"] },
  // Admin-only surfaces.
  { prefix: "/contact-center", roles: ["admin"] },
  // Shared operational surface: opened from Lost & Found and Contact Center.
  { prefix: "/feedback", roles: ["admin", "agent"] },
  { prefix: "/workflow-monitor", roles: ["admin"] },
  { prefix: "/notifications", roles: ["admin"] },
  { prefix: "/timeline", roles: ["admin"] },
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/integrations", roles: ["admin"] },
  { prefix: "/api-status", roles: ["admin"] },
  { prefix: "/settings", roles: ["admin"] },
  { prefix: "/export-center", roles: ["admin"] },
  { prefix: "/route-tracking", roles: ["admin", "coordinator"] },
  { prefix: "/passenger", roles: ["admin"] }, // /passenger/$token is public and handled separately
];

export function canAccessPath(pathname: string, role: AppRole | null): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const rule = RULES.find((r) =>
    r.exact ? pathname === r.prefix : pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  if (!rule) return false;
  return rule.roles.includes(role);
}

export function defaultPathForRole(role: AppRole | null): string {
  switch (role) {
    case "driver":
      return "/driver-portal";
    case "coordinator":
      return "/";
    case "agent":
      return "/";
    case "admin":
      return "/";
    default:
      return "/auth";
  }
}

const RolePriority: Record<AppRole, number> = {
  admin: 0,
  coordinator: 1,
  agent: 1,
  driver: 1,
};

export const RoleContext = createContext<{ role: AppRole | null; loading: boolean }>({
  role: null,
  loading: true,
});

export function useRole() {
  return useContext(RoleContext);
}

export function useCurrentRole(
  userId: string | null | undefined,
  metadataRole?: unknown,
) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setRole(null);
      setResolvedUserId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const loadRole = async () => {
      let result = await supabase.from("user_roles").select("role").eq("user_id", userId);
      for (let attempt = 0; result.error && attempt < 2; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
        result = await supabase.from("user_roles").select("role").eq("user_id", userId);
      }
      const { data, error } = result;
        if (cancelled) return;
        const fallbackRole =
          metadataRole === "admin" ||
          metadataRole === "agent" ||
          metadataRole === "coordinator" ||
          metadataRole === "driver"
            ? metadataRole
            : null;
        if (error) {
          // app_metadata is issued by the Auth server and cannot be changed by
          // the signed-in user. It safely bridges transient role-query errors.
          setRole(fallbackRole);
        } else if (!data || data.length === 0) {
          setRole(null);
        } else {
          const known = data
            .map((r) => r.role as string)
            .filter((r): r is AppRole => r === "admin" || r === "agent" || r === "coordinator" || r === "driver");
          known.sort((a, b) => RolePriority[a] - RolePriority[b]);
          setRole(known[0] ?? null);
        }
        setResolvedUserId(userId);
        setLoading(false);
    };
    void loadRole();
    return () => {
      cancelled = true;
    };
  }, [userId, metadataRole]);

  return { role, loading, resolvedUserId };
}