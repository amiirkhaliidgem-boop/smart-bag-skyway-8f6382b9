import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  useAdminStore,
  ROLE_DESCRIPTIONS,
  addUser,
  updateUser,
  setUserStatus,
  deleteUser,
  resetPassword,
  usersByRole,
  hasPermission,
  ADMIN_MODULES,
  PERMISSION_ACTIONS,
  type AdminUser,
  type EmploymentStatus,
  type PermissionAction,
  type AdminModule,
} from "@/lib/admin/data";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Building2,
  MapPin,
  UsersRound,
  ScrollText,
  Search,
  MoreHorizontal,
  Plus,
  Check,
  Minus,
  Eye,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const adminSearchSchema = z.object({
  section: z
    .enum(["users", "roles", "permissions", "departments", "stations", "teams", "activity"])
    .catch("users")
    .default("users"),
});

export const Route = createFileRoute("/admin")({
  validateSearch: adminSearchSchema,
  head: () => ({
    meta: [
      { title: "Administration — IAB Smart Baggage" },
      {
        name: "description",
        content:
          "Enterprise administration center: users, roles, permissions, departments, stations, teams, and activity logs.",
      },
    ],
  }),
  component: AdminCenter,
});

const CURRENT_ACTOR = { name: "Mostafa Reda", role: "SystemAdministrator" as Role };

const SECTIONS = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Roles", icon: ShieldCheck },
  { id: "permissions", label: "Permissions", icon: KeySquare },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "stations", label: "Stations", icon: MapPin },
  { id: "teams", label: "Teams", icon: UsersRound },
  { id: "activity", label: "Activity Logs", icon: ScrollText },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function AdminCenter() {
  const { section } = useSearch({ from: "/admin" }) as { section: SectionId };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Administration
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Administration Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise identity, access, and organizational configuration for the IAB Smart Baggage Ecosystem.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{CURRENT_ACTOR.name}</span>
          {" · "}
          <span>{ROLE_LABELS[CURRENT_ACTOR.role]}</span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <Link
              key={s.id}
              to="/admin"
              search={{ section: s.id }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </Link>
          );
        })}
      </nav>

      {section === "users" && <UsersSection />}
      {section === "roles" && <RolesSection />}
      {section === "permissions" && <PermissionsSection />}
      {section === "departments" && <DepartmentsSection />}
      {section === "stations" && <StationsSection />}
      {section === "teams" && <TeamsSection />}
      {section === "activity" && <ActivitySection />}
    </div>
  );
}

/* -------------------- USERS -------------------- */

function UsersSection() {
  const users = useAdminStore((s) => s.users);
  const departments = useAdminStore((s) => s.departments);
  const stations = useAdminStore((s) => s.stations);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sort, setSort] = useState<"name" | "created" | "activity">("activity");

  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (deptFilter !== "all" && u.department !== deptFilter) return false;
      if (
        q &&
        !u.fullName.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q) &&
        !u.id.toLowerCase().includes(q) &&
        !u.position.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.lastActivity.localeCompare(a.lastActivity);
    });
  }, [users, search, roleFilter, statusFilter, deptFilter, sort]);

  const kpi = useMemo(() => {
    const active = users.filter((u) => u.status === "Active").length;
    const disabled = users.filter((u) => u.status === "Disabled").length;
    return { total: users.length, active, disabled };
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Total Employees" value={kpi.total} icon={Users} />
        <KpiCard label="Active" value={kpi.active} icon={Check} tone="emerald" />
        <KpiCard label="Disabled" value={kpi.disabled} icon={Ban} tone="rose" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Employees</CardTitle>
          <Button size="sm" onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, employee ID…"
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.filter((r) => r !== "Passenger").map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
                <SelectItem value="Invited">Invited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {users.length} employees</span>
            <div className="flex items-center gap-2">
              <span>Sort:</span>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity">Last Activity</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="created">Newest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold", u.avatarColor)}>
                          {u.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.fullName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{u.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{u.email}</div>
                      <div className="text-muted-foreground">{u.mobile}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{u.department}</div>
                      <div className="text-xs text-muted-foreground">{u.position}</div>
                    </TableCell>
                    <TableCell className="text-sm">{ROLE_LABELS[u.role]}</TableCell>
                    <TableCell className="text-sm">{u.station}</TableCell>
                    <TableCell><StatusPill status={u.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.lastActivity).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(u)}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditing(u)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {u.status === "Active" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setUserStatus(u.id, "Disabled", CURRENT_ACTOR);
                                toast.success(`${u.fullName} disabled`);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-2" /> Disable
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setUserStatus(u.id, "Active", CURRENT_ACTOR);
                                toast.success(`${u.fullName} activated`);
                              }}
                            >
                              <Check className="h-4 w-4 mr-2" /> Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              resetPassword(u.id, CURRENT_ACTOR);
                              toast.success("Password reset link generated");
                            }}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => setConfirmDelete(u)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      No employees match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ViewUserDialog user={viewing} onClose={() => setViewing(null)} />
      <EditUserDialog
        user={editing}
        departments={departments.map((d) => d.name)}
        stations={stations.map((s) => s.name)}
        onClose={() => setEditing(null)}
      />
      <CreateUserDialog
        open={creating}
        departments={departments.map((d) => d.name)}
        stations={stations.map((s) => s.name)}
        onClose={() => setCreating(false)}
      />
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete employee</DialogTitle>
            <DialogDescription>
              This permanently removes {confirmDelete?.fullName} ({confirmDelete?.id}) from the system.
              This action is logged. Admin only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  deleteUser(confirmDelete.id, CURRENT_ACTOR);
                  toast.success(`${confirmDelete.fullName} deleted`);
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: EmploymentStatus }) {
  const styles: Record<EmploymentStatus, string> = {
    Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Disabled: "bg-rose-100 text-rose-700 border-rose-200",
    Invited: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium", styles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone?: "slate" | "emerald" | "rose" | "blue";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-md grid place-items-center", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ViewUserDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {user && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className={cn("h-12 w-12 rounded-full grid place-items-center text-sm font-semibold", user.avatarColor)}>
                  {user.avatarInitials}
                </div>
                <div>
                  <DialogTitle>{user.fullName}</DialogTitle>
                  <DialogDescription className="font-mono text-xs">{user.id}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Email" value={user.email} />
              <Field label="Mobile" value={user.mobile} />
              <Field label="Department" value={user.department} />
              <Field label="Position" value={user.position} />
              <Field label="Station" value={user.station} />
              <Field label="Role" value={ROLE_LABELS[user.role]} />
              <Field label="Status" value={user.status} />
              <Field label="Last Activity" value={new Date(user.lastActivity).toLocaleString("en-GB")} />
              <Field label="Created" value={new Date(user.createdAt).toLocaleDateString("en-GB")} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EditUserDialog({
  user,
  departments,
  stations,
  onClose,
}: {
  user: AdminUser | null;
  departments: string[];
  stations: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminUser | null>(null);

  useMemo(() => {
    setForm(user);
  }, [user]);

  if (!user || !form) {
    return (
      <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>Update role, department, and contact information.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Position</Label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div>
            <Label>Station</Label>
            <Select value={form.station} onValueChange={(v) => setForm({ ...form, station: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stations.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r !== "Passenger").map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const changed: Partial<AdminUser> = {};
              const keys: (keyof AdminUser)[] = ["fullName", "email", "mobile", "department", "position", "station", "role"];
              for (const k of keys) if (form[k] !== user[k]) (changed as Record<string, unknown>)[k] = form[k];
              if (Object.keys(changed).length === 0) {
                onClose();
                return;
              }
              const action =
                changed.role ? "Role Changed" :
                changed.department ? "Department Changed" :
                "User Updated";
              const details =
                changed.role ? `${ROLE_LABELS[user.role]} → ${ROLE_LABELS[form.role]}` :
                changed.department ? `${user.department} → ${form.department}` :
                Object.keys(changed).map((k) => `${k} updated`).join(", ");
              updateUser(user.id, changed, CURRENT_ACTOR, action, details);
              toast.success(`${user.fullName} updated`);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  departments,
  stations,
  onClose,
}: {
  open: boolean;
  departments: string[];
  stations: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    department: departments[0] ?? "",
    position: "",
    station: stations[0] ?? "",
    role: "LostAndFoundAgent" as Role,
    status: "Active" as EmploymentStatus,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>Create a new employee record. Authentication is provisioned separately.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Position</Label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div>
            <Label>Station</Label>
            <Select value={form.station} onValueChange={(v) => setForm({ ...form, station: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stations.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r !== "Passenger").map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.fullName.trim() || !form.email.trim()}
            onClick={() => {
              addUser(form, CURRENT_ACTOR);
              toast.success(`${form.fullName} added`);
              onClose();
              setForm({ ...form, fullName: "", email: "", mobile: "", position: "" });
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- ROLES -------------------- */

function RolesSection() {
  const users = useAdminStore((s) => s.users);
  const counts = usersByRole(users);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ROLES.map((r) => {
        const perms = countPermissionsForRole(r);
        return (
          <Card key={r}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{ROLE_LABELS[r]}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
                {r === "Passenger" && <Badge variant="outline">Reference</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Users</p>
                  <p className="text-lg font-semibold">{r === "Passenger" ? "—" : counts[r]}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Permissions</p>
                  <p className="text-lg font-semibold">{perms.granted} / {perms.total}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {perms.modules.slice(0, 5).map((m) => (
                  <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                ))}
                {perms.modules.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">+{perms.modules.length - 5}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function countPermissionsForRole(role: Role) {
  let granted = 0;
  const total = ADMIN_MODULES.length * PERMISSION_ACTIONS.length;
  const modules: AdminModule[] = [];
  for (const m of ADMIN_MODULES) {
    let has = false;
    for (const a of PERMISSION_ACTIONS) {
      if (hasPermission(role, m, a)) {
        granted++;
        has = true;
      }
    }
    if (has) modules.push(m);
  }
  return { granted, total, modules };
}

/* -------------------- PERMISSIONS -------------------- */

function PermissionsSection() {
  const [role, setRole] = useState<Role>("StationManager");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Permission Matrix</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Bound to the enterprise Role Architecture. Cells reflect the RBAC contract in <code className="font-mono">roles.ts</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {PERMISSION_ACTIONS.map((a) => (
                  <TableHead key={a} className="text-center">{a}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADMIN_MODULES.map((m) => (
                <TableRow key={m}>
                  <TableCell className="font-medium">{m}</TableCell>
                  {PERMISSION_ACTIONS.map((a) => (
                    <TableCell key={a} className="text-center">
                      <PermCell has={hasPermission(role, m, a as PermissionAction)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Read-only view. Permission changes are governed by the Role Architecture engine and are audit-logged when applied.
        </p>
      </CardContent>
    </Card>
  );
}

function PermCell({ has }: { has: boolean }) {
  return has ? (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700">
      <Check className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}

/* -------------------- DEPARTMENTS -------------------- */

function DepartmentsSection() {
  const departments = useAdminStore((s) => s.departments);
  const users = useAdminStore((s) => s.users);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Departments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => {
            const count = users.filter((u) => u.department === d.name).length;
            return (
              <Card key={d.id} className="shadow-none border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{d.id}</p>
                    </div>
                    <Badge variant="secondary">{count} staff</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Head: </span>
                    <span className="font-medium">{d.head}</span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- STATIONS -------------------- */

function StationsSection() {
  const stations = useAdminStore((s) => s.stations);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stations</CardTitle>
        <p className="text-xs text-muted-foreground">
          Multi-station architecture is enabled. Additional stations can be activated as operations expand.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.code}</TableCell>
                  <TableCell className="text-sm font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.city}</TableCell>
                  <TableCell className="text-sm">{s.country}</TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Active</Badge>
                    ) : (
                      <Badge variant="outline">Planned</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- TEAMS -------------------- */

function TeamsSection() {
  const teams = useAdminStore((s) => s.teams);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teams</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <Card key={t.id} className="shadow-none border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{t.id}</p>
                  </div>
                  <Badge variant="secondary">{t.memberCount} members</Badge>
                </div>
                <div className="text-xs space-y-0.5">
                  <p><span className="text-muted-foreground">Department: </span><span className="font-medium">{t.department}</span></p>
                  <p><span className="text-muted-foreground">Station: </span><span className="font-medium">{t.station}</span></p>
                  <p><span className="text-muted-foreground">Lead: </span><span className="font-medium">{t.lead}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- ACTIVITY -------------------- */

function ActivitySection() {
  const activity = useAdminStore((s) => s.activity);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const actions = useMemo(() => Array.from(new Set(activity.map((a) => a.action))), [activity]);
  const filtered = useMemo(() => {
    return activity.filter((a) => {
      if (actionFilter !== "all" && a.action !== actionFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !a.actor.toLowerCase().includes(needle) &&
          !a.target.toLowerCase().includes(needle) &&
          !(a.details ?? "").toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [activity, q, actionFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Administrative Activity</CardTitle>
        <p className="text-xs text-muted-foreground">Append-only audit trail of every administration action.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search actor, target, details…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Affected Object</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(a.at).toLocaleString("en-GB")}</TableCell>
                  <TableCell className="text-sm font-medium">{a.actor}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{ROLE_LABELS[a.actorRole]}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[11px]">{a.action}</Badge></TableCell>
                  <TableCell className="text-sm">{a.target}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.details ?? "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No activity matches the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Unused imports guard (kept for clarity of the icon set — Plus is used by dropdowns/dialogs typing)
void Plus;