import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackageSearch,
  Warehouse,
  Search,
  Truck,
  BarChart3,
  QrCode,
  Headphones,
  Star,
  Radar,
  Bell,
  Activity,
  ShieldCheck,
  GitBranch,
  Plug,
  Radio,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useRole, canAccessPath, ROLE_LABELS } from "@/lib/rbac";
import { usePermissions } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterSlot,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const SIDEBAR_STORAGE_KEY = "iab.sidebar.expanded";

const navSections: {
  label: string;
  items: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
    search?: Record<string, string>;
    matchSearchKey?: string;
  }[];
}[] = [
  {
    label: "Operations",
    items: [{ to: "/", label: "Executive Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Baggage Operations",
    items: [
      { to: "/lost-found", label: "Lost & Found", icon: PackageSearch },
      { to: "/tracking", label: "Baggage Tracking", icon: Search },
      { to: "/feedback", label: "Customer Feedback", icon: Star },
    ],
  },
  {
    label: "Delivery Operations",
    items: [
      { to: "/delivery", label: "Delivery Management", icon: Truck },
      { to: "/agent-monitoring", label: "Delivery Agent Monitoring", icon: Radar },
    ],
  },
  {
    label: "Warehouse Operations",
    items: [
      { to: "/storage", label: "Storage Control", icon: Warehouse },
      { to: "/qr-scan", label: "QR Scan", icon: QrCode },
    ],
  },
  {
    label: "CONTACT CENTER OPERATIONS",
    items: [{ to: "/contact-center", label: "Contact Center", icon: Headphones }],
  },
  {
    label: "Operations Center",
    items: [
      { to: "/workflow-monitor", label: "Workflow Monitor", icon: GitBranch },
      { to: "/notifications", label: "Notification Center", icon: Bell },
      { to: "/timeline", label: "Activity Timeline", icon: Activity },
    ],
  },
  {
    label: "Reporting",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3 },
      // HIDDEN until the Import / Export phase: route, RBAC and backend are preserved.
      // { to: "/data-io", label: "Import / Export", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/admin", label: "Administration", icon: ShieldCheck }],
  },
  {
    label: "System",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/api-status", label: "API Status", icon: Radio },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppShell() {
  const [open, setOpen] = useState(true);

  // Restore the persisted desktop collapse state after hydration.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) setOpen(stored === "1");
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable — collapse still works for the session */
    }
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * The single application header. Every authenticated page renders this via
 * the AppShell — no module defines its own topbar.
 */
function AppHeader() {
  return (
    // The header shares the sidebar's surface, border, typography and motion
    // tokens so the two read as one continuous navigation shell.
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-2 text-sidebar-foreground transition-[background-color,border-color] duration-200 sm:px-4">
      {/* Desktop toggling happens on the sidebar logo; this trigger is the
          mobile/tablet way back to the navigation drawer. */}
      <SidebarTrigger className="min-h-10 min-w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden" />
      <UserIdentity />
      <span className="pointer-events-none absolute inset-x-0 flex justify-center px-24">
        <span className="hidden truncate text-sm font-semibold tracking-tight text-sidebar-foreground sm:inline">
          IAB Smart Baggage Center
        </span>
      </span>
      <div className="relative z-10 ml-auto flex items-center gap-3">
        <SignOutButton />
      </div>
    </header>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentSection = useRouterState({
    select: (s) => (s.location.search as { section?: string })?.section,
  });
  const { role } = useRole();
  const perms = usePermissions();
  const { isMobile, setOpen, setOpenMobile, toggleSidebar } = useSidebar();

  // Auto-close the overlay drawer whenever the route changes.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /**
   * Standard navigation behaviour on every device: picking a module minimises
   * the sidebar so the content immediately takes the full width. Clicking the
   * logo brings it back.
   */
  function collapseAfterNavigation() {
    setOpenMobile(false);
    setOpen(false);
  }

  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            perms.unmanaged ? canAccessPath(item.to, role) : perms.canAccess(item.to),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [perms, role],
  );

  const isActive = (to: string, exact?: boolean, matchSearchKey?: string) => {
    const pathMatch = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
    if (!pathMatch) return false;
    if (!matchSearchKey) return true;
    const current = currentSection ?? "users"; // /admin defaults to users
    return current === matchSearchKey;
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          className="flex w-full items-center gap-2 rounded-md py-2 pl-0 pr-2 text-left outline-none transition-[opacity,transform] duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.98]"
        >
          {/* Nav icons sit at 24px from the sidebar edge (group p-2 + button
              p-2 + half of a 16px icon), in both the expanded and the 48px
              icon rail. A 32px tile flush against the header's own 8px
              padding puts the logo centre on that exact same 24px axis. */}
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-card shadow ring-1 ring-sidebar-border">
            <img src={iabLogo.url} alt="IAB" className="h-7 w-7 object-contain" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-bold leading-none tracking-tight">IAB</span>
            <span className="mt-1 block truncate text-[11px] text-sidebar-foreground/60">
              Smart Baggage Ecosystem
            </span>
          </span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.to, item.exact, item.matchSearchKey);
                  return (
                    <SidebarMenuItem key={`${item.to}-${item.label}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "transition-[background-color,color,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-disabled:pointer-events-none aria-disabled:opacity-50",
                          active &&
                            "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                        )}
                      >
                        <Link
                          to={item.to}
                          search={item.search as never}
                          onClick={collapseAfterNavigation}
                        >
                          <item.icon />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooterSlot className="border-t border-sidebar-border text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
        {role ? (
          // Plain text, no filled pill — it blends into the sidebar surface.
          <p className="truncate bg-transparent text-[11px] font-medium text-sidebar-foreground">
            {ROLE_LABELS[role]}
          </p>
        ) : null}
        <p className="font-medium text-sidebar-foreground/80">Ops Console v2.6</p>
        <p>© 2026 Cairo Ground Services</p>
      </SidebarFooterSlot>
    </Sidebar>
  );
}

/** User name + live system state. No role text — roles live in the sidebar. */
function UserIdentity() {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const display =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        (typeof meta.username === "string" && meta.username) ||
        data.user?.email ||
        "";
      setName(display);
    });
  }, []);
  return (
    <div className="relative z-10 flex min-w-0 flex-col justify-center leading-tight">
      <span className="truncate text-xs font-semibold text-sidebar-foreground">{name}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/70">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" aria-hidden />
        <span className="truncate">System Online</span>
      </span>
    </div>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-md border border-sidebar-border bg-transparent px-2.5 text-xs font-medium text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
