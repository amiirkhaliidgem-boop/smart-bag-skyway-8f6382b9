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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";

const navItems = [
  { to: "/", label: "Executive Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/lost-found", label: "Lost & Found", icon: PackageSearch },
  { to: "/storage", label: "Storage Control", icon: Warehouse },
  { to: "/tracking", label: "Passenger Tracking", icon: Search },
  { to: "/delivery", label: "Delivery Management", icon: Truck },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <SidebarBrand />
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive(item.to, item.exact)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
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
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                    isActive(item.to, item.exact)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "hover:bg-sidebar-accent",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
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
              <p className="text-xs text-muted-foreground leading-none">Cairo International Airport</p>
              <p className="text-sm font-semibold truncate">Smart Baggage Ecosystem</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Online
            </div>
            <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-semibold">
              OP
            </div>
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