import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Shield, UserCheck, KeyRound } from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchUsers() {
  const res = await fetch(`${BASE()}/api/auth/users`);
  return res.json();
}

interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "sales";
}

export default function AdminUsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", role: "sales" as "admin" | "sales" });
  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: users = [] } = useQuery<UserRecord[]>({
    queryKey: ["auth-users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE()}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      setOpen(false);
      setForm({ username: "", password: "", fullName: "", role: "sales" });
      toast({ title: "İstifadəçi əlavə edildi" });
    },
    onError: (e: any) => toast({ title: "Xəta", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE()}/api/auth/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "İstifadəçi silindi" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`${BASE()}/api/auth/users/${id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      return res.json();
    },
    onSuccess: () => {
      setPwOpen(false);
      setPwTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Şifrə uğurla dəyişdirildi" });
    },
    onError: (e: any) => toast({ title: "Xəta", description: e.message, variant: "destructive" }),
  });

  function openPasswordDialog(u: UserRecord) {
    setPwTarget(u);
    setNewPassword("");
    setConfirmPassword("");
    setPwOpen(true);
  }

  function handleChangePassword() {
    if (!pwTarget) return;
    if (newPassword.length < 6) {
      toast({ title: "Xəta", description: "Şifrə ən az 6 simvol olmalıdır", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Xəta", description: "Şifrələr uyğun gəlmir", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ id: pwTarget.id, password: newPassword });
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Bu səhifəyə yalnız admin daxil ola bilər.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">İstifadəçilər</h1>
          <p className="text-muted-foreground text-sm mt-1">Admin və satış nümayəndələrini idarə edin</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <PlusCircle className="w-4 h-4" /> Yeni istifadəçi
        </Button>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {u.role === "admin" ? (
                  <Shield className="w-5 h-5 text-primary" />
                ) : (
                  <UserCheck className="w-5 h-5 text-green-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{u.fullName}</div>
                <div className="text-sm text-muted-foreground">@{u.username}</div>
              </div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                {u.role === "admin" ? "Admin" : "Satış"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openPasswordDialog(u)}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                title="Şifrəni dəyiş"
              >
                <KeyRound className="w-4 h-4" />
              </Button>
              {u.id !== currentUser?.id && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(u.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Hələ istifadəçi yoxdur</div>
        )}
      </div>

      {/* Password change dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Şifrəni Dəyiş — <span className="text-primary">@{pwTarget?.username}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Yeni Şifrə</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 6 simvol"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Şifrəni Təsdiqlə</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Eyni şifrəni daxil edin"
                className="rounded-xl h-11"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Şifrələr uyğun gəlmir</p>
              )}
            </div>
            <Button
              className="w-full h-11 rounded-xl"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending || !newPassword || !confirmPassword}
            >
              {changePasswordMutation.isPending ? "Saxlanılır..." : "Şifrəni Dəyiş"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New user dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni İstifadəçi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ad Soyad</label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Əli Məmmədov"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">İstifadəçi adı</label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="ali"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Şifrə</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select value={form.role} onValueChange={(v: any) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales">Satış nümayəndəsi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
            >
              Əlavə et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
