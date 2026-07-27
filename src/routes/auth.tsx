import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { touchLastLogin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { defaultPathForRole, type AppRole } from "@/lib/rbac";

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    for (const key of ["message", "error_description", "code", "statusText"]) {
      const detail = value[key];
      if (typeof detail === "string" && detail.trim()) return detail;
    }
    if (typeof value.status === "number") {
      return `Authentication failed (${value.status}).`;
    }
  }
  return "Authentication failed. Please check your credentials and try again.";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — IAB Smart Baggage Ecosystem" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already signed in, bounce to the role's default landing path.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const to = await resolveDefaultPath(data.session.user.id);
      navigate({ to, replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const email = await resolveLoginIdentity(identifier);
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
        void touchLastLogin().catch(() => {});
        const to = await resolveDefaultPath(data.user?.id ?? null);
        navigate({ to, replace: true });
        return;
      }
      // Signup path: role may not be assigned yet — send to home; AuthGate will handle.
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

async function resolveDefaultPath(userId: string | null): Promise<string> {
  if (!userId) return "/";
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? [])
    .map((r) => r.role as string)
    .filter((r): r is AppRole =>
      r === "admin" || r === "agent" || r === "coordinator" || r === "driver",
    );
  // Prefer admin if present.
  const role: AppRole | null = roles.includes("admin")
    ? "admin"
    : (roles[0] ?? null);
  return defaultPathForRole(role);
}

/**
 * Staff may sign in with a username (no corporate email required). Usernames are
 * resolved to the account's internal sign-in identity before authenticating.
 */
async function resolveLoginIdentity(input: string): Promise<string> {
  const value = input.trim();
  if (value.includes("@")) return value;
  const { data } = await supabase.rpc("login_identity_for_username", { _username: value });
  return (typeof data === "string" && data) || `${value.toLowerCase()}@staff.local`;
}

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-white ring-1 ring-border grid place-items-center overflow-hidden">
            <img src={iabLogo.url} alt="IAB" className="h-9 w-9 object-contain" />
          </div>
          <CardTitle>IAB Smart Baggage Ecosystem</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to continue" : "Create a staff account"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">
                {mode === "signin" ? "Username, Employee ID, or Email" : "Email"}
              </Label>
              <Input
                id="identifier"
                type={mode === "signin" ? "text" : "email"}
                required
                autoComplete={mode === "signin" ? "username" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{mode === "signin" ? "Password / PIN" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin"
                ? "New here? Create a staff account"
                : "Have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}