import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAdminWorkspace,
  saveAppUser,
  setUserStatus,
  deleteAppUser,
  resetUserCredential,
  assignUserRole,
  saveRole,
  deleteRole,
  savePermissions,
} from "@/lib/admin.functions";
import {
  RBAC_ACTIONS,
  RBAC_MODULES,
  DEPARTMENTS,
  type AdminUserRecord,
  type AdminWorkspaceData,
} from "@/lib/admin/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  ShieldCheck,
  KeySquare,
  ScrollText,
  Search,
  MoreHorizontal,
  Plus,
  Ban,
  RotateCcw,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration · Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Live user directory, role management, permission matrix and administration activity log for airport baggage operations.",
      },
      { property: "og:title", content: "Administration · Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Manage staff accounts, delivery agent PINs, roles and permissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
}

function AdminPage() {
  const fetchWorkspace = useServerFn(getAdminWorkspace);
  const { data, isLoading, error } = useQuery<AdminWorkspaceData>({
    queryKey: ["admin-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading administration workspace…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Unable to load the administration workspace."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Live user directory, roles, permission matrix and audit trail.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={data.users.length} icon={Users} />
        <StatCard
          label="Active"
          value={data.users.filter((u) => u.status === "Active").length}
          icon={ShieldCheck}
        />
        <StatCard
          label="Delivery Agents"
          value={data.users.filter((u) => u.user_type === "driver").length}
          icon={KeySquare}
        />
        <StatCard label="Roles" value={data.roles.length} icon={ScrollText} />
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab data={data} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab data={data} />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsTab data={data} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin-workspace"] });
}

/* ------------------------------- Users ---------------------------------- */

const EMPTY_FORM = {
  id: undefined as string | undefined,
  employeeId: "",
  fullName: "",
  username: "",
  email: "",
  mobile: "",
  department: DEPARTMENTS[0] as string,
  status: "Active" as "Active" | "Disabled" | "Invited",
  userType: "staff" as "staff" | "driver",
  roleId: "",
  password: "",
  pin: "",
};

function UsersTab({ data }: { data: AdminWorkspaceData }) {
  const invalidate = useInvalidate();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetTarget, setResetTarget] = useState<AdminUserRecord | null>(null);
  const [credential, setCredential] = useState("");

  const save = useMutation({
    mutationFn: useServerFn(saveAppUser),
    onSuccess: () => {
      toast.success("User saved");
      setOpen(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: useServerFn(setUserStatus),
    onSuccess: () => {
      toast.success("Status updated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: useServerFn(deleteAppUser),
    onSuccess: () => {
      toast.success("User deleted");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: useServerFn(resetUserCredential),
    onSuccess: () => {
      toast.success("Credential reset");
      setResetTarget(null);
      setCredential("");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const assign = useMutation({
    mutationFn: useServerFn(assignUserRole),
    onSuccess: () => {
      toast.success("Role updated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleName = (id: string | null) => data.roles.find((r) => r.id === id)?.name ?? "Unassigned";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== "all" && u.role_id !== roleFilter) return false;
      if (!q) return true;
      return [u.full_name, u.username, u.employee_id, u.email ?? "", u.department]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data.users, query, roleFilter]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, roleId: data.roles[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(u: AdminUserRecord) {
    setForm({
      id: u.id,
      employeeId: u.employee_id,
      fullName: u.full_name,
      username: u.username,
      email: u.email ?? "",
      mobile: u.mobile ?? "",
      department: u.department || DEPARTMENTS[0],
      status: (u.status as "Active") ?? "Active",
      userType: (u.user_type as "staff") ?? "staff",
      roleId: u.role_id ?? data.roles[0]?.id ?? "",
      password: "",
      pin: "",
    });
    setOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">User Directory</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, username, employee ID…"
              className="h-9 w-64 pl-8"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {data.roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Logon</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.employee_id}</TableCell>
                <TableCell>
                  <Select
                    value={u.role_id ?? ""}
                    onValueChange={(roleId) => assign.mutate({ data: { id: u.id, roleId } })}
                  >
                    <SelectTrigger className="h-8 w-48">
                      <SelectValue placeholder={roleName(u.role_id)} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {u.user_type === "driver" ? "Delivery Agent" : "Staff"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      u.status === "Active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {u.status}
                  </Badge>
                  {u.user_type === "driver" && !u.user_id && (
                    <div className="mt-1 text-[11px] text-amber-600">
                      PIN reset required to activate sign-in
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmt(u.last_login_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(u)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          status.mutate({
                            data: {
                              id: u.id,
                              status: u.status === "Active" ? "Disabled" : "Active",
                            },
                          })
                        }
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        {u.status === "Active" ? "Disable" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetTarget(u)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {u.user_type === "driver" ? "Reset PIN" : "Reset Password"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => remove.mutate({ data: { id: u.id } })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No users match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit User" : "Create User"}</DialogTitle>
            <DialogDescription>
              Staff accounts sign in with their username and password — email is optional.
              Delivery agents sign in on the same login page with their username or
              employee ID and their PIN, and land in the Delivery Agent Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account Type">
              <Select
                value={form.userType}
                onValueChange={(v) => setForm((f) => ({ ...f, userType: v as "staff" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="driver">Delivery Agent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employee ID">
              <Input
                value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              />
            </Field>
            <Field label="Full Name">
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Mobile (optional)">
              <Input
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </Field>
            <Field label="Department">
              <Select
                value={form.department}
                onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role">
              <Select
                value={form.roleId}
                onValueChange={(v) => setForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {data.roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as "Active" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Disabled">Disabled</SelectItem>
                  <SelectItem value="Invited">Invited</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.userType === "staff" ? (
              <Field label={form.id ? "New Password (optional)" : "Password"}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
            ) : (
              <Field label={form.id ? "New PIN (optional, 6-8 digits)" : "Portal PIN (6-8 digits)"}>
                <Input
                  inputMode="numeric"
                  maxLength={8}
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
                />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate({ data: { ...form } })}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset credential dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resetTarget?.user_type === "driver" ? "Reset PIN" : "Reset Password"}
            </DialogTitle>
            <DialogDescription>{resetTarget?.full_name}</DialogDescription>
          </DialogHeader>
          <Input
            type={resetTarget?.user_type === "driver" ? "text" : "password"}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={
              resetTarget?.user_type === "driver" ? "New PIN (6-8 digits)" : "New password"
            }
            maxLength={resetTarget?.user_type === "driver" ? 8 : undefined}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={reset.isPending || !credential}
              onClick={() =>
                resetTarget &&
                reset.mutate({
                  data:
                    resetTarget.user_type === "driver"
                      ? { id: resetTarget.id, pin: credential }
                      : { id: resetTarget.id, password: credential },
                })
              }
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------- Roles ---------------------------------- */

function RolesTab({ data }: { data: AdminWorkspaceData }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "", cloneFromRoleId: "" });

  const save = useMutation({
    mutationFn: useServerFn(saveRole),
    onSuccess: () => {
      toast.success("Role saved");
      setOpen(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: useServerFn(deleteRole),
    onSuccess: () => {
      toast.success("Role deleted");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    data.users.forEach((u) => u.role_id && m.set(u.role_id, (m.get(u.role_id) ?? 0) + 1));
    return m;
  }, [data.users]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Roles</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setForm({ id: "", name: "", description: "", cloneFromRoleId: "" });
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New Role
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.description}</TableCell>
                <TableCell>{counts.get(r.id) ?? 0}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.is_system ? "Built-in" : "Custom"}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setForm({
                            id: r.id,
                            name: r.name,
                            description: r.description,
                            cloneFromRoleId: "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setForm({
                            id: "",
                            name: `${r.name} (Copy)`,
                            description: r.description,
                            cloneFromRoleId: r.id,
                          });
                          setOpen(true);
                        }}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" /> Clone
                      </DropdownMenuItem>
                      {!r.is_system && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => remove.mutate({ data: { id: r.id } })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Role" : "New Role"}</DialogTitle>
            <DialogDescription>
              {form.cloneFromRoleId
                ? "Permissions are copied from the source role."
                : "Set permissions in the Permissions tab after saving."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Role Name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || form.name.trim().length < 2}
              onClick={() =>
                save.mutate({
                  data: {
                    id: form.id || undefined,
                    name: form.name,
                    description: form.description,
                    cloneFromRoleId: form.cloneFromRoleId || undefined,
                  },
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------- Permissions -------------------------------- */

function PermissionsTab({ data }: { data: AdminWorkspaceData }) {
  const invalidate = useInvalidate();
  const [roleId, setRoleId] = useState(data.roles[0]?.id ?? "");
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const base = useMemo(() => {
    const map: Record<string, boolean> = {};
    data.permissions
      .filter((p) => p.role_id === roleId)
      .forEach((p) => (map[`${p.module}|${p.action}`] = p.allowed));
    return map;
  }, [data.permissions, roleId]);

  const value = (key: string) => draft[key] ?? base[key] ?? false;
  const dirty = Object.keys(draft).filter((k) => draft[k] !== (base[k] ?? false));

  const save = useMutation({
    mutationFn: useServerFn(savePermissions),
    onSuccess: () => {
      toast.success("Permissions saved");
      setDraft({});
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Permission Matrix</CardTitle>
        <div className="flex items-center gap-2">
          <Select
            value={roleId}
            onValueChange={(v) => {
              setRoleId(v);
              setDraft({});
            }}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={dirty.length === 0 || save.isPending}
            onClick={() =>
              save.mutate({
                data: {
                  roleId,
                  changes: dirty.map((k) => {
                    const [module, action] = k.split("|");
                    return { module, action, allowed: draft[k] };
                  }),
                },
              })
            }
          >
            Save {dirty.length > 0 ? `(${dirty.length})` : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[190px]">Module</TableHead>
              {RBAC_ACTIONS.map((a) => (
                <TableHead key={a} className="text-center text-xs">
                  {a}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {RBAC_MODULES.map((m) => (
              <TableRow key={m}>
                <TableCell className="font-medium">{m}</TableCell>
                {RBAC_ACTIONS.map((a) => {
                  const key = `${m}|${a}`;
                  return (
                    <TableCell key={a} className="text-center">
                      <Checkbox
                        checked={value(key)}
                        onCheckedChange={(c) =>
                          setDraft((d) => ({ ...d, [key]: c === true }))
                        }
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Activity ---------------------------------- */

function ActivityTab({ data }: { data: AdminWorkspaceData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Administration Activity Log</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.audit.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground">{fmt(a.created_at)}</TableCell>
                <TableCell>{a.actor_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{a.action}</Badge>
                </TableCell>
                <TableCell>{a.target}</TableCell>
                <TableCell className="text-muted-foreground">{a.details}</TableCell>
              </TableRow>
            ))}
            {data.audit.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No administration activity recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}