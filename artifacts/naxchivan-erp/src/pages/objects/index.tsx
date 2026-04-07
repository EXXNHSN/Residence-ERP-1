import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useListBlocks, useListTariffs, useListCustomers, ObjectType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Loader2, Store, MapPin, Building2, Search, Pencil, Trash2, MoreVertical, KeyRound, User, Phone, Calendar, Banknote, ArrowUpRight, LayoutGrid, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey, useCreateObject } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { formatArea, formatCurrency } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { format } from "date-fns";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ObjectsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterKvartal, setFilterKvartal] = useState("all");
  const [filterBlock, setFilterBlock] = useState("all");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editObj, setEditObj] = useState<any | null>(null);
  const [deleteObj, setDeleteObj] = useState<any | null>(null);
  const [rentObj, setRentObj] = useState<any | null>(null);
  const [rentLoading, setRentLoading] = useState(false);

  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allObjects, isLoading } = useListObjects({ type: ObjectType.object });
  const { data: blocks } = useListBlocks();
  const { data: tariffs } = useListTariffs();
  const { data: customers } = useListCustomers();

  const { mutate: createObj, isPending } = useCreateObject({
    mutation: {
      onSuccess: () => {
        setIsAddOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
        toast({ title: "Qeyri yaşayış sahəsi əlavə edildi" });
      }
    }
  });

  // Single add form
  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: { number: "", area: "", blockId: "", activityType: "" }
  });

  // Bulk creation form
  const { register: bulkReg, handleSubmit: bulkSubmit, control: bulkCtrl, reset: bulkReset, watch: bulkWatch } = useForm({
    defaultValues: { blockId: "", count: "5", area: "", startNumber: "1", prefix: "" }
  });

  // Edit form
  const { register: editReg, handleSubmit: editSubmit, control: editCtrl, setValue: editSetVal } = useForm({
    defaultValues: { number: "", area: "", blockId: "", activityType: "" }
  });

  // Rent form
  const { register: rentReg, handleSubmit: rentSubmit, control: rentCtrl, reset: rentReset } = useForm({
    defaultValues: {
      tenantName: "", tenantPhone: "", tenantFin: "", contractNumber: "",
      customerId: "", startDate: "", endDate: "", monthlyAmount: ""
    }
  });

  const onAdd = (data: any) => {
    createObj({
      data: {
        type: ObjectType.object,
        number: data.number,
        area: Number(data.area),
        blockId: data.blockId ? Number(data.blockId) : undefined,
        activityType: data.activityType || undefined
      } as any
    });
  };

  async function onBulkCreate(data: any) {
    if (!data.blockId) { toast({ title: "Blok seçin", variant: "destructive" }); return; }
    try {
      const res = await fetch(`${BASE()}/api/objects/object-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId: Number(data.blockId),
          count: Number(data.count),
          area: data.area ? Number(data.area) : 0,
          startNumber: Number(data.startNumber),
          prefix: data.prefix || "",
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const r = await res.json();
      queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
      toast({ title: `${r.count} obyekt yaradıldı` });
      setIsBulkOpen(false);
      bulkReset();
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    }
  }

  function openEdit(obj: any) {
    editSetVal("number", obj.number ?? "");
    editSetVal("area", String(obj.area ?? ""));
    editSetVal("blockId", obj.blockId?.toString() ?? "");
    editSetVal("activityType", obj.activityType ?? "");
    setEditObj(obj);
  }

  function openRent(obj: any) {
    rentReset();
    setRentObj(obj);
  }

  async function handleEdit(adminPassword: string, data: any) {
    const res = await fetch(`${BASE()}/api/objects/${editObj.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin", password: adminPassword,
        ...data,
        area: Number(data.area),
        blockId: (data.blockId && data.blockId !== "none") ? Number(data.blockId) : null
      }),
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
    toast({ title: `"${deleteObj.number}" silindi` });
    setDeleteObj(null);
  }

  async function handleRent(data: any) {
    if (!rentObj) return;
    setRentLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/rentals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "object",
          assetId: rentObj.id,
          tenantName: data.tenantName || null,
          tenantPhone: data.tenantPhone || null,
          tenantFin: data.tenantFin || null,
          contractNumber: data.contractNumber || null,
          customerId: (data.customerId && data.customerId !== "none") ? Number(data.customerId) : null,
          startDate: data.startDate,
          endDate: data.endDate,
          monthlyAmount: Number(data.monthlyAmount),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Xəta"); }
      queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["renters"] });
      toast({ title: `"${rentObj.number}" icarəyə verildi` });
      setRentObj(null);
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setRentLoading(false);
    }
  }

  const uniqueKvartals = useMemo(() => {
    if (!blocks) return [];
    const seen = new Set<number>();
    return blocks.filter((b: any) => b.quarterId && !seen.has(b.quarterId) && seen.add(b.quarterId))
      .map((b: any) => ({ id: b.quarterId, name: b.quarterName ?? `Kvartal ${b.quarterId}` }));
  }, [blocks]);

  const filteredBlocksForFilter = useMemo(() => {
    if (!blocks) return [];
    if (filterKvartal === "all") return blocks;
    return blocks.filter((b: any) => b.quarterId?.toString() === filterKvartal);
  }, [blocks, filterKvartal]);

  const filtered = useMemo(() => {
    if (!allObjects) return [];
    return allObjects.filter((o: any) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterBlock !== "all" && o.blockId?.toString() !== filterBlock) return false;
      if (filterKvartal !== "all" && filterBlock === "all") {
        const block = blocks?.find((b: any) => b.id === o.blockId);
        if (!block || block.quarterId?.toString() !== filterKvartal) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          o.number?.toLowerCase().includes(q) ||
          o.activityType?.toLowerCase().includes(q) ||
          o.blockName?.toLowerCase().includes(q) ||
          o.quarterName?.toLowerCase().includes(q) ||
          o.tenantName?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allObjects, filterStatus, filterKvartal, filterBlock, search, blocks]);

  const stats = useMemo(() => ({
    total: allObjects?.length ?? 0,
    available: allObjects?.filter((o: any) => o.status === "available").length ?? 0,
    sold: allObjects?.filter((o: any) => o.status === "sold").length ?? 0,
    rented: allObjects?.filter((o: any) => o.status === "rented").length ?? 0,
  }), [allObjects]);

  const bulkCount = Number(bulkWatch("count")) || 0;
  const bulkPrefix = bulkWatch("prefix") || "";
  const bulkStart = Number(bulkWatch("startNumber")) || 1;

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Qeyri Yaşayış</h1>
            <p className="text-muted-foreground mt-1">Kommersiya, ofis və digər qeyri yaşayış sahələri</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk creation button */}
            <Button variant="outline" className="rounded-xl border-dashed gap-2"
              onClick={() => setIsBulkOpen(true)}>
              <LayoutGrid className="w-4 h-4" /> Toplu Yarat
            </Button>
            {/* Single add button */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl px-5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                  <Plus className="w-4 h-4 mr-1.5" /> Tək Əlavə et
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-display flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary" /> Yeni Qeyri Yaşayış Sahəsi
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onAdd)} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Nömrə / Ad</Label>
                    <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: 1A, Mağaza-1..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Sahə (m²)</Label>
                    <Input type="number" step="0.01" {...register("area")} className="rounded-xl h-11" placeholder="Məs: 80" />
                  </div>
                  <div className="space-y-2">
                    <Label>Yerləşdiyi Blok</Label>
                    <Controller name="blockId" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                        <SelectContent>
                          {blocks?.map(b => (
                            <SelectItem key={b.id} value={b.id.toString()}>
                              {b.quarterName ? `${b.quarterName} / ` : ""}{b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fəaliyyət Sahəsi</Label>
                    <Input {...register("activityType")} className="rounded-xl h-11" placeholder="Məs: Ərzaq, Apteka, Ofis..." />
                  </div>
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl">
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Cəmi Obyekt", value: stats.total, color: "bg-card border-border/50", textColor: "text-foreground", status: "all" },
            { label: "Boş (Satışa hazır)", value: stats.available, color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700", status: "available" },
            { label: "İcarədə", value: stats.rented, color: "bg-indigo-50 border-indigo-200", textColor: "text-indigo-700", status: "rented" },
            { label: "Satılmış", value: stats.sold, color: "bg-rose-50 border-rose-200", textColor: "text-rose-700", status: "sold" },
          ].map(s => (
            <button key={s.label} onClick={() => setFilterStatus(s.status)}
              className={`${s.color} rounded-2xl border p-5 shadow-sm text-left transition-all hover:shadow-md ${filterStatus === s.status ? "ring-2 ring-primary ring-offset-1" : ""}`}>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.textColor}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ad, fəaliyyət, blok, icarəçi..." className="pl-9 rounded-xl h-10 bg-card border-border/60" />
          </div>
          <Select value={filterKvartal} onValueChange={v => { setFilterKvartal(v); setFilterBlock("all"); }}>
            <SelectTrigger className="w-[160px] rounded-xl h-10 bg-card"><SelectValue placeholder="Kvartal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Kvartallar</SelectItem>
              {uniqueKvartals.map((q: any) => <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-[170px] rounded-xl h-10 bg-card"><SelectValue placeholder="Blok" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Bloklar</SelectItem>
              {filteredBlocksForFilter.map((b: any) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.name}{b.quarterName ? ` (${b.quarterName})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterKvartal !== "all" || filterBlock !== "all" || search) && (
            <button onClick={() => { setFilterKvartal("all"); setFilterBlock("all"); setSearch(""); }}
              className="text-xs text-primary hover:underline">
              Sıfırla
            </button>
          )}
          {tariffs && (
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 ml-auto">
              <span>1 m² satış:</span>
              <span className="font-semibold text-foreground">{formatCurrency(tariffs.objectPricePerSqm)}</span>
              {(tariffs as any).objectMonthlyRent && (
                <>
                  <span className="text-border">·</span>
                  <span>Aylıq İcarə:</span>
                  <span className="font-semibold text-foreground">{formatCurrency((tariffs as any).objectMonthlyRent)}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="font-medium text-foreground">Nəticə tapılmadı</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filterStatus !== "all"
                  ? <button onClick={() => setFilterStatus("all")} className="text-primary hover:underline">Bütün obyektlərə bax</button>
                  : "Yeni qeyri yaşayış sahəsi əlavə edin"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-5">Ad / Nömrə</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Fəaliyyət</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Blok / Kvartal</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Sahə</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Qiymət</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status / İcarəçi</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((obj: any) => (
                  <TableRow key={obj.id}
                    className={`hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0 ${obj.status === "rented" ? "bg-indigo-50/30" : ""}`}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          obj.status === "rented" ? "bg-indigo-100" :
                          obj.status === "sold" ? "bg-rose-100" :
                          "bg-primary/10"
                        }`}>
                          <Store className={`w-4 h-4 ${
                            obj.status === "rented" ? "text-indigo-600" :
                            obj.status === "sold" ? "text-rose-600" :
                            "text-primary"
                          }`} />
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
                      <div className="space-y-1">
                        <StatusBadge status={obj.status} />
                        {obj.status === "rented" && obj.tenantName && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-xs font-medium text-indigo-700">
                              <User className="w-3 h-3" /> {obj.tenantName}
                            </div>
                            {obj.monthlyAmount && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Banknote className="w-3 h-3" /> {formatCurrency(obj.monthlyAmount)}/ay
                              </div>
                            )}
                            {obj.rentalEnd && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" /> {format(new Date(obj.rentalEnd), "dd.MM.yyyy")}-ə qədər
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {obj.status === "available" && (
                          <Button size="sm" variant="outline"
                            className="h-7 px-2.5 text-xs rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1"
                            onClick={() => openRent(obj)}>
                            <KeyRound className="w-3 h-3" /> İcarə
                          </Button>
                        )}
                        {obj.status === "rented" && (
                          <Link href="/renters">
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-xs rounded-lg text-indigo-600 hover:bg-indigo-50 gap-1">
                              <ArrowUpRight className="w-3 h-3" /> Arendator
                            </Button>
                          </Link>
                        )}
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-50 hover:opacity-100">
                                <MoreVertical className="w-3.5 h-3.5" />
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
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 0 && (
            <div className="px-5 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{filtered.length} nəticə</span>
              {(filterStatus !== "all" || filterKvartal !== "all" || filterBlock !== "all" || search) && (
                <button onClick={() => { setFilterStatus("all"); setFilterKvartal("all"); setFilterBlock("all"); setSearch(""); }} className="text-xs text-primary hover:underline">
                  Filteri sıfırla
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Creation Dialog ── */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" /> Toplu Qeyri Yaşayış Sahəsi Yarat
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Bir blok üçün birdəfəyə çoxlu obyekt yaratmaq üçün istifadə edin</p>
          </DialogHeader>
          <form onSubmit={bulkSubmit(onBulkCreate)} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Yerləşdiyi Blok *</Label>
              <Controller name="blockId" control={bulkCtrl} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                  <SelectContent>
                    {blocks?.map(b => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.quarterName ? `${b.quarterName} / ` : ""}{b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Obyekt sayı *</Label>
                <Input type="number" min="1" max="50" {...bulkReg("count", { required: true })} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label>Sahə (m²)</Label>
                <Input type="number" step="0.01" placeholder="0" {...bulkReg("area")} className="rounded-xl h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nömrə prefiksi</Label>
                <Input {...bulkReg("prefix")} className="rounded-xl h-11" placeholder="Məs: Mağaza-" />
              </div>
              <div className="space-y-2">
                <Label>Başlanğıc nömrə</Label>
                <Input type="number" min="1" {...bulkReg("startNumber")} className="rounded-xl h-11" />
              </div>
            </div>
            {bulkCount > 0 && (
              <div className="rounded-xl bg-muted/50 border border-border/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Nümunə nömrələr:</p>
                <p className="font-mono text-xs">
                  {Array.from({ length: Math.min(bulkCount, 5) }, (_, i) => `${bulkPrefix}${bulkStart + i}`).join(", ")}
                  {bulkCount > 5 ? ` ... ${bulkPrefix}${bulkStart + bulkCount - 1}` : ""}
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setIsBulkOpen(false)}>Ləğv et</Button>
              <Button type="submit" className="flex-1 rounded-xl">
                {bulkCount} Obyekt Yarat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Rent Dialog ── */}
      <Dialog open={!!rentObj} onOpenChange={v => !v && setRentObj(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              İcarəyə Ver: <span className="text-indigo-600">{rentObj?.number}</span>
            </DialogTitle>
            {rentObj && (
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5" />
                {rentObj.quarterName ?? ""} {rentObj.blockName ?? ""} · {formatArea(rentObj.area)}
              </p>
            )}
          </DialogHeader>
          <form onSubmit={rentSubmit(handleRent)} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Mövcud Sakin</Label>
              <Controller name="customerId" control={rentCtrl} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Sakin bağla (isteğe bağlı)..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sakin bağlama —</SelectItem>
                    {customers?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.firstName} {c.lastName} {c.fin ? `· ${c.fin}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>İcarədar adı *</Label>
                <Input {...rentReg("tenantName", { required: true })} className="rounded-xl h-10" placeholder="Ad Soyad" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...rentReg("tenantPhone")} className="rounded-xl h-10" placeholder="+994..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>FIN</Label>
                <Input {...rentReg("tenantFin")} className="rounded-xl h-10" placeholder="7 simvol" />
              </div>
              <div className="space-y-2">
                <Label>Müqavilə №</Label>
                <Input {...rentReg("contractNumber")} className="rounded-xl h-10" placeholder="İcarə-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Başlama tarixi *</Label>
                <Input type="date" {...rentReg("startDate", { required: true })} className="rounded-xl h-10" />
              </div>
              <div className="space-y-2">
                <Label>Bitmə tarixi *</Label>
                <Input type="date" {...rentReg("endDate", { required: true })} className="rounded-xl h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Aylıq icarə haqqı (AZN) *</Label>
              <Input type="number" step="0.01" {...rentReg("monthlyAmount", { required: true })}
                className="rounded-xl h-11" placeholder="Məs: 2000" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setRentObj(null)}>Ləğv et</Button>
              <Button type="submit" disabled={rentLoading} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                {rentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "İcarəyə ver"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <AdminEditDialog
        open={!!editObj}
        onClose={() => setEditObj(null)}
        title={`Redaktə: ${editObj?.number ?? ""}`}
        saveLabel="Yadda saxla"
        onSave={async (pw) => { await editSubmit(data => handleEdit(pw, data))(); }}
      >
        <form className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nömrə / Ad</Label>
            <Input {...editReg("number", { required: true })} className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <Label>Sahə (m²)</Label>
            <Input type="number" step="0.01" {...editReg("area")} className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <Label>Blok</Label>
            <Controller name="blockId" control={editCtrl} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seçilməyib —</SelectItem>
                  {blocks?.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.quarterName ? `${b.quarterName} / ` : ""}{b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1.5">
            <Label>Fəaliyyət Sahəsi</Label>
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
