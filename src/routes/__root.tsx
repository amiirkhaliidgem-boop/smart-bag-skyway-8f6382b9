import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "../components/app-shell";
import { Toaster } from "../components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { RoleContext, canAccessPath, defaultPathForRole, useCurrentRole } from "@/lib/rbac";
import { PermissionContext, firstAllowedPath, useLivePermissions } from "@/lib/permissions";
import { moduleForPath } from "@/lib/admin/modules";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Enterprise baggage operations platform: lost & found, storage control, passenger tracking, and home delivery.",
      },
      { name: "author", content: "Cairo Ground Services" },
      { property: "og:title", content: "Smart Baggage Ecosystem" },
      { property: "og:description", content: "Enterprise airport baggage operations platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://cdn.fontshare.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Reem+Kufi:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

// Public paths that don't require staff sign-in.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/auth" || pathname.startsWith("/passenger/") // token portal only; /passenger alone is staff
  );
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const {
    role,
    loading: roleLoading,
    resolvedUserId,
  } = useCurrentRole(session?.user?.id ?? null, session?.user?.app_metadata?.role);
  const claimedRole = session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role;
  const effectiveRole =
    role ??
    (claimedRole === "admin" ||
    claimedRole === "agent" ||
    claimedRole === "coordinator" ||
    claimedRole === "driver"
      ? claimedRole
      : null);
  const roleReadyForSession = resolvedUserId === (session?.user?.id ?? null);
  const perms = useLivePermissions(session?.user?.id ?? null);

  useEffect(() => {
    // Surfaces Workflow Engine rejections (validation, permissions, and
    // optimistic-concurrency conflicts) raised by the operations store.
    const handleOpsError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (!detail?.message) return;
      const conflict = /version|40001|conflict/i.test(detail.message);
      toast.error(conflict ? "This record changed elsewhere" : "Operation rejected", {
        description: conflict
          ? "Reload the page and retry — someone else updated this record."
          : detail.message,
        duration: 10_000,
      });
    };
    window.addEventListener("app:ops-error", handleOpsError);
    return () => window.removeEventListener("app:ops-error", handleOpsError);
  }, []);

  // Live RBAC is authoritative. Accounts without an Administration record
  // fall back to the legacy role matrix so nobody is locked out.
  const allowPath = (pathname: string) => {
    // Delivery Agents are confined to their portal, whatever else is granted.
    if (effectiveRole === "driver") {
      return pathname === "/driver-portal" || pathname.startsWith("/driver-portal/");
    }
    return perms.unmanaged
      ? canAccessPath(pathname, effectiveRole)
      : perms.granted.has(`${moduleForPath(pathname)}|View`);
  };
  const landingPath = () =>
    effectiveRole === "driver"
      ? "/driver-portal"
      : perms.unmanaged
        ? defaultPathForRole(effectiveRole)
        : firstAllowedPath(perms.granted, effectiveRole);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session && !isPublicPath(pathname)) {
      navigate({ to: "/auth", replace: true });
    }
  }, [ready, session, pathname, navigate]);

  // Role-based redirect for signed-in users on disallowed paths.
  useEffect(() => {
    if (!ready || !session || roleLoading || !roleReadyForSession || perms.loading) return;
    if (isPublicPath(pathname)) return;
    if (!effectiveRole) {
      // Keep a valid session intact if the role lookup is temporarily
      // unavailable; no protected content is rendered without a role.
      toast.error("Unable to verify your staff role. Please refresh and try again.");
      return;
    }
    if (!allowPath(pathname)) {
      navigate({ to: landingPath(), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    session,
    effectiveRole,
    roleLoading,
    roleReadyForSession,
    pathname,
    navigate,
    perms.loading,
    perms.granted,
    perms.unmanaged,
  ]);

  if (!ready) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Public routes render bare (no sidebar).
  if (isPublicPath(pathname)) {
    return <Outlet />;
  }

  // Protected: don't flash the shell before redirect completes.
  if (!session) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  if (roleLoading || !roleReadyForSession || perms.loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!effectiveRole) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Unable to verify your staff role. Please refresh and try again.
      </div>
    );
  }

  // Block rendering of disallowed routes while the redirect effect runs.
  if (effectiveRole && !allowPath(pathname)) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return (
    <RoleContext.Provider value={{ role: effectiveRole, loading: roleLoading }}>
      <PermissionContext.Provider value={perms}>
        {effectiveRole === "driver" ? <Outlet /> : <AppShell />}
      </PermissionContext.Provider>
    </RoleContext.Provider>
  );
}
