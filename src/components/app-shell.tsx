import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackageSearch,
  Warehouse,
  Search,
  Truck,
  BarChart3,
  Menu,
  X,
  QrCode,
  Headphones,
  Star,
  UserCog,
  Bell,
  Activity,
  ShieldCheck,
  Users as UsersIcon,
  KeySquare,
  Building2,
  MapPin,
  UsersRound,
  GitBranch,
  Plug,
  Radio,
  ArrowRightLeft,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useRole, canAccessPath, ROLE_LABELS } from "@/lib/rbac";

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
    items: [
      { to: "/", label: "Executive Dashboard", icon: LayoutDashboard, exact: true },
    ],
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
      { to: "/driver-portal", label: "Delivery Agent Portal", icon: UserCog },
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
    items: [
      { to: "/tracking", label: "Baggage Tracking", icon: Search },
      { to: "/contact-center", label: "Contact Center", icon: Headphones },
      { to: "/feedback", label: "Customer Feedback", icon: Star },
    ],
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
      { to: "/data-io", label: "Import / Export", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/admin", label: "Users", icon: UsersIcon, search: { section: "users" }, matchSearchKey: "users" },
      { to: "/admin", label: "Roles", icon: ShieldCheck, search: { section: "roles" }, matchSearchKey: "roles" },
      { to: "/admin", label: "Permissions", icon: KeySquare, search: { section: "permissions" }, matchSearchKey: "permissions" },
      { to: "/admin", label: "Departments", icon: Building2, search: { section: "departments" }, matchSearchKey: "departments" },
      { to: "/admin", label: "Stations", icon: MapPin, search: { section: "stations" }, matchSearchKey: "stations" },
      { to: "/admin", label: "Teams", icon: UsersRound, search: { section: "teams" }, matchSearchKey: "teams" },
    ],
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentSection = useRouterState({
    select: (s) => (s.location.search as { section?: string })?.section,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useRole();

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessPath(item.to, role)),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (
    to: string,
    exact?: boolean,
    matchSearchKey?: string,
  ) => {
    const pathMatch = exact
      ? pathname === to
      : pathname === to || pathname.startsWith(to + "/");
    if (!pathMatch) return false;
    if (!matchSearchKey) return true;
    // For sub-nav items that share a route, match on the `section` search param.
    const current = currentSection ?? "users"; // /admin defaults to users
    return current === matchSearchKey;
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <SidebarBrand />
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    search={item.search as never}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive(item.to, item.exact, item.matchSearchKey)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <SidebarBrand onClose={() => setMobileOpen(false)} />
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
              {visibleSections.map((section) => (
                <div key={section.label}>
                  <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={`${item.to}-${item.label}`}
                        to={item.to}
                        search={item.search as never}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                          isActive(item.to, item.exact, item.matchSearchKey)
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "hover:bg-sidebar-accent",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-30 relative">
          <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={iabLogo.url}
              alt="IAB"
              className="hidden sm:block h-8 w-8 rounded-md object-contain bg-white ring-1 ring-border p-0.5"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Smart Baggage Ecosystem</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Online
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarBrand({ onClose }: { onClose?: () => void }) {
  return (
    <div className="relative h-16 px-5 flex items-center gap-3 border-b border-sidebar-border">
      <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-sidebar-primary to-transparent" />
      <div className="h-10 w-10 rounded-lg bg-white grid place-items-center shadow ring-1 ring-sidebar-border overflow-hidden">
        <img src={iabLogo.url} alt="IAB" className="h-9 w-9 object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold tracking-tight leading-none">IAB</p>
        <p className="text-[11px] text-sidebar-foreground/60 mt-1">Smart Baggage Ecosystem</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 rounded hover:bg-sidebar-accent" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="px-5 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
      <p className="font-medium text-sidebar-foreground/80">Ops Console v2.6</p>
      <p className="mt-0.5">© 2026 Cairo Ground Services</p>
    </div>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const { role } = useRole();
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex flex-col items-end leading-tight max-w-[220px]">
        <span className="text-xs text-foreground truncate">{email}</span>
        {role && (
          <span className="text-[10px] text-muted-foreground truncate">
            {ROLE_LABELS[role]}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted"
        aria-label="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  );
}