import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { Button } from "@/components/ui/button";
import { LanguageToggle, useDriverLang } from "@/lib/i18n/driver-language";

/**
 * Branded chrome for the Delivery Agent Portal.
 * Mirrors the topbar of the main AppShell (logo, product name, user, sign out)
 * so the portal reads as another module of the same enterprise system.
 */
export function DriverShell({
  agentName,
  onSignOut,
  children,
}: {
  agentName?: string | null;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const { t } = useDriverLang();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary" />
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={iabLogo.url}
            alt="IAB"
            className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-border"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Smart Baggage Ecosystem
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {t.portalTitle}
            </p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2 sm:gap-3">
          {agentName && (
            <span className="hidden max-w-[180px] truncate text-xs font-medium text-muted-foreground sm:inline">
              {agentName}
            </span>
          )}
          <LanguageToggle />
          {onSignOut && (
            <Button variant="outline" size="sm" onClick={onSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t.signOut}</span>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}