import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useListBlocks, useListTariffs, ObjectType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Loader2, Store, MapPin, Building2, Search, Pencil, Trash2, MoreVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey, useCreateObject } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { formatArea, formatCurrency } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ObjectsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editObj, setEditObj] = useState<any | null>(null);
  const [deleteObj, setDeleteObj] = useState<any | null>(null);

  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allObjects, isLoading } = useListObjects({ type: ObjectType.object });
  const { data: blocks } = useListBlocks();
  const { data: tariffs } = useListTariffs();

  const { mutate: createObj, isPending } = useCreateObject({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
        toast({ title: "Qeyri yaşayış əlavə edildi" });
      }
    }
  });

  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: { number: "", area: "", blockId: "", activityType: "" }
  });

  const { register: editReg, handleSubmit: editSubmit, control: editCtrl, reset: editReset, setValue: editSetVal } = useForm({
    defaultValues: { number: "", area: "", blockId: "", activityType: "" }
  });

  const onSubmit = (data: any) => {
    createObj({ data: { type: ObjectType.object, number: data.number, area: Number(data.area), blockId: data.blockId ? Number(data.blockId) : undefined, activityType: data.activityType || undefined } as any });
  };

  function openEdit(obj: any) {
    editSetVal("number", obj.number ?? "");
    editSetVal("area", obj.area ?? "");
    editSetVal("blockId", obj.blockId?.toString() ?? "");
    editSetVal("activityType", obj.activityType ?? "");
    setEditObj(obj);
  }

  const filtered = useMemo(() => {
    if (!allObjects) return [];
    return allObjects.filter((o: any) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = o.number?.toLowerCase().includes(q) ||
          o.activityType?.toLowerCase().includes(q) ||
          o.blockName?.toLowerCase().includes(q) ||
          o.quarterName?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allObjects, filterStatus, search]);

  const stats = useMemo(() => ({
    total: allObjects?.length ?? 0,
    available: allObjects?.filter((o: any) => o.status === "available").length ?? 0,
    sold: allObjects?.filter((o: any) => o.status === "sold").length ?? 0,
    rented: allObjects?.filter((o: any) => o.status === "rented").length ?? 0,
  }), [allObjects]);

  async function handleEdit(adminPassword: string, data: any) {
    const res = await fetch(`${BASE()}/api/objects/${editObj.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: adminPassword, ...data, area: Number(data.area), blockId: (data.blockId && data.blockId !== "none") ? Number(data.blockId) : null }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Xəta"); }
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
    toast({ title: "Dəyişikliklər yadda saxlandı" });
    setEditObj(null);
  }

  async function handleDelete(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/objects/${deleteObj.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: adminPassword }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Silmə xətası"); }
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
    toast({ title: `"${deleteObj.number}" silindi`, variant: "default" });
    setDeleteObj(null);
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Qeyri Yaşayış</h1>
            <p className="text-muted-foreground mt-1">Kommersiya, ofis və digər qeyri yaşayış sahələri</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 flex-shrink-0">
                <Plus className="w-4 h-4 mr-1.5" /> Yeni Əlavə et
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" /> Yeni Qeyri Yaşayış
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nömrə / Ad</label>
                  <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: Mağaza 1A, Ofis 201..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sahə (m²)</label>
                  <Input type="number" step="0.01" {...register("area", { required: true })} className="rounded-xl h-11" placeholder="Məs: 120" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Yerləşdiyi Blok</label>
                  <Controller name="blockId" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                      <SelectContent>
                        {blocks?.map(b => (
                          <SelectItem key={b.id} value={b.id.toString()}>
                            {b.name} {b.quarterName ? `(${b.quarterName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fəaliyyət Sahəsi</label>
                  <Input {...register("activityType")} className="rounded-xl h-11" placeholder="Məs: Ərzaq mağazası, Apteka, Ofis..." />
                </div>
                <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl">
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { label: "Cəmi", value: stats.total, active: filterStatus === "all", onClick: () => setFilterStatus("all"), activeBg: "bg-foreground text-white" },
            { label: "Boş", value: stats.available, active: filterStatus === "available", onClick: () => setFilterStatus("available"), activeBg: "bg-emerald-600 text-white", idleColor: "text-emerald-700" },
            { label: "Satılıb", value: stats.sold, active: filterStatus === "sold", onClick: () => setFilterStatus("sold"), activeBg: "bg-rose-600 text-white", idleColor: "text-rose-600" },
            { label: "İcarədə", value: stats.rented, active: filterStatus === "rented", onClick: () => setFilterStatus("rented"), activeBg: "bg-indigo-600 text-white", idleColor: "text-indigo-600" },
          ].map(s => (
            <button key={s.label} onClick={s.onClick}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-all ${
                s.active ? `${s.activeBg} border-transparent shadow-sm` : `bg-white border-border/60 ${(s as any).idleColor ?? "text-foreground"} hover:bg-muted/40`
              }`}>
              <span>{s.label}</span>
              <span className={`rounded-lg px-1.5 py-0.5 text-xs font-bold ${s.active ? "bg-white/20" : "bg-muted"}`}>{s.value}</span>
            </button>
          ))}
          {tariffs && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground self-center">
              <span>1 m² =</span>
              <span className="font-semibold text-foreground">{formatCurrency(tariffs.objectPricePerSqm)}</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ad, fəaliyyət, blok axtarın..." className="pl-9 rounded-xl h-10 bg-white border-border/60" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="font-medium text-foreground">Nəticə tapılmadı</p>
              <p className="text-sm text-muted-foreground mt-1">Filteri dəyişdirin və ya yeni qeyri yaşayış əlavə edin</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="w-12 text-xs font-semibold text-muted-foreground pl-5">#</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Ad / Nömrə</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Fəaliyyət</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Blok / Kvartal</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Sahə</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Qiymət</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((obj: any) => (
                  <TableRow key={obj.id} className="hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0">
                    <TableCell className="pl-5 text-xs text-muted-foreground font-mono">{obj.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-sm text-foreground">{obj.number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {obj.activityType
                        ? <span className="text-sm text-foreground">{obj.activityType}</span>
                        : <span className="text-sm text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      {obj.blockName ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <Building2 className="w-3 h-3 text-muted-foreground" /> {obj.blockName}
                          </div>
                          {obj.quarterName && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-2.5 h-2.5" /> {obj.quarterName}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-sm text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">{formatArea(obj.area)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-primary">{formatCurrency(obj.salePrice)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={obj.status} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-50 hover:opacity-100">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => openEdit(obj)} className="gap-2 cursor-pointer">
                              <Pencil className="w-4 h-4 text-primary" /> Redaktə et
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteObj(obj)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4" /> Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 0 && (
            <div className="px-5 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{filtered.length} nəticə</span>
              {(filterStatus !== "all" || search) && (
                <button onClick={() => { setFilterStatus("all"); setSearch(""); }} className="text-xs text-primary hover:underline">
                  Filteri sıfırla
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Dialog ── */}
      <AdminEditDialog
        open={!!editObj}
        onClose={() => setEditObj(null)}
        title={`Redaktə: ${editObj?.number ?? ""}`}
        saveLabel="Yadda saxla"
        onSave={async (pw) => {
          await editSubmit(data => handleEdit(pw, data))();
        }}
      >
        <form className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nömrə / Ad</label>
            <Input {...editReg("number", { required: true })} className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sahə (m²)</label>
            <Input type="number" step="0.01" {...editReg("area")} className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Blok</label>
            <Controller name="blockId" control={editCtrl} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seçilməyib —</SelectItem>
                  {blocks?.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name} {b.quarterName ? `(${b.quarterName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fəaliyyət Sahəsi</label>
            <Input {...editReg("activityType")} className="rounded-xl h-10" placeholder="Məs: Ərzaq mağazası..." />
          </div>
        </form>
      </AdminEditDialog>

      {/* ── Delete Dialog ── */}
      <AdminEditDialog
        open={!!deleteObj}
        onClose={() => setDeleteObj(null)}
        title={`Silinsin: ${deleteObj?.number ?? ""}`}
        saveLabel="Sil"
        saveVariant="destructive"
        onSave={handleDelete}
      >
        <div className="rounded-xl bg-red-50 border border-destructive/20 p-4 text-sm text-destructive">
          <strong>"{deleteObj?.number}"</strong> qeyri yaşayış sahəsi silinəcək. Bu əməliyyat geri qaytarıla bilməz.
        </div>
      </AdminEditDialog>
    </AppLayout>
  );
}
