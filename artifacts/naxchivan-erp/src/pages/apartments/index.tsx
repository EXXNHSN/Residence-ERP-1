import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListApartments, useCreateApartment, useListBlocks, ApartmentStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Home, Pencil, SlidersHorizontal, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListApartmentsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatArea } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-white border-primary shadow-sm"
          : "bg-card border-border/60 text-muted-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}

export default function ApartmentsPage() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterKvartal, setFilterKvartal] = useState<string>("all");
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterRooms, setFilterRooms] = useState<string>("all");
  const [filterFloors, setFilterFloors] = useState<Set<number>>(new Set());

  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<any>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editRooms, setEditRooms] = useState("");
  const [editArea, setEditArea] = useState("");

  const { data: allApartments, isLoading } = useListApartments({
    status: filterStatus !== "all" ? filterStatus as ApartmentStatus : undefined
  });

  const { data: blocks } = useListBlocks();

  const uniqueKvartals = useMemo(() => {
    if (!blocks) return [];
    const seen = new Map<string, { id: number; name: string }>();
    blocks.forEach(b => {
      if (b.quarterId && b.quarterName && !seen.has(b.quarterName)) {
        seen.set(b.quarterName, { id: b.quarterId, name: b.quarterName });
      }
    });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks]);

  const filteredBlocks = useMemo(() => {
    if (!blocks) return [];
    if (filterKvartal === "all") return blocks;
    return blocks.filter(b => b.quarterId?.toString() === filterKvartal);
  }, [blocks, filterKvartal]);

  const apartments = useMemo(() => {
    if (!allApartments) return [];
    return allApartments.filter(apt => {
      if (filterBlock !== "all") {
        const block = blocks?.find(b => b.id === apt.blockId);
        if (!block || block.id.toString() !== filterBlock) return false;
      } else if (filterKvartal !== "all") {
        const block = blocks?.find(b => b.id === apt.blockId);
        if (!block || block.quarterId?.toString() !== filterKvartal) return false;
      }
      if (filterRooms !== "all" && apt.rooms !== Number(filterRooms)) return false;
      if (filterFloors.size > 0 && !filterFloors.has(apt.floor)) return false;
      return true;
    });
  }, [allApartments, blocks, filterBlock, filterKvartal, filterRooms, filterFloors]);

  const uniqueFloors = useMemo(() => {
    if (!allApartments) return [];
    return [...new Set(allApartments.map(a => a.floor))].sort((a, b) => a - b);
  }, [allApartments]);

  const uniqueRooms = useMemo(() => {
    if (!allApartments) return [];
    return [...new Set(allApartments.map(a => a.rooms))].sort((a, b) => a - b);
  }, [allApartments]);

  const toggleFloor = (floor: number) => {
    setFilterFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor); else next.add(floor);
      return next;
    });
  };

  const hasActiveFilters = filterKvartal !== "all" || filterBlock !== "all" || filterRooms !== "all" || filterFloors.size > 0 || filterStatus !== "all";

  const clearAllFilters = () => {
    setFilterKvartal("all");
    setFilterBlock("all");
    setFilterRooms("all");
    setFilterFloors(new Set());
    setFilterStatus("all");
  };

  const queryClient = useQueryClient();
  const { mutate: createApartment, isPending } = useCreateApartment({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListApartmentsQueryKey() });
      }
    }
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: { blockId: "", number: "", floor: "", rooms: "", area: "" }
  });

  const onSubmit = (data: any) => {
    createApartment({
      data: {
        blockId: Number(data.blockId),
        number: data.number,
        floor: Number(data.floor),
        rooms: Number(data.rooms),
        area: Number(data.area)
      }
    });
  };

  function openEdit(apt: any) {
    setEditingApt(apt);
    setEditNumber(apt.number ?? "");
    setEditFloor(String(apt.floor ?? ""));
    setEditRooms(String(apt.rooms ?? ""));
    setEditArea(String(apt.area ?? ""));
    setEditOpen(true);
  }

  async function handleSaveApartment(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/apartments/${editingApt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username,
        password: adminPassword,
        number: editNumber,
        floor: Number(editFloor),
        rooms: Number(editRooms),
        area: Number(editArea),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `Mənzil #${editNumber} yeniləndi` });
    queryClient.invalidateQueries({ queryKey: getListApartmentsQueryKey() });
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Mənzillər</h1>
            <p className="text-muted-foreground mt-1">
              Bütün mənzillərin siyahısı
              {apartments && <span className="ml-1 text-primary font-semibold">({apartments.length} nəticə)</span>}
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 shrink-0">
                  <Plus className="w-5 h-5 mr-2" /> Yeni Mənzil
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-display">Yeni Mənzil</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blok</label>
                    <Controller
                      name="blockId"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {blocks?.map(b => (
                              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mənzil №</label>
                      <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: 15" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mərtəbə</label>
                      <Input type="number" {...register("floor", { required: true })} className="rounded-xl h-11" placeholder="Məs: 5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Otaq Sayı</label>
                      <Input type="number" min="1" {...register("rooms", { required: true })} className="rounded-xl h-11" placeholder="Məs: 3" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sahə (m²)</label>
                      <Input type="number" step="0.01" {...register("area", { required: true })} className="rounded-xl h-11" placeholder="Məs: 85.5" />
                    </div>
                  </div>
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-md mt-4">
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" />
              Filterlər
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
              >
                <X className="w-3 h-3" /> Sıfırla
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Kvartal</p>
              <Select value={filterKvartal} onValueChange={(v) => { setFilterKvartal(v); setFilterBlock("all"); }}>
                <SelectTrigger className="h-9 rounded-xl text-sm bg-background">
                  <SelectValue placeholder="Hamısı" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün Kvartallar</SelectItem>
                  {uniqueKvartals.map(q => (
                    <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Blok / Bina</p>
              <Select value={filterBlock} onValueChange={setFilterBlock}>
                <SelectTrigger className="h-9 rounded-xl text-sm bg-background">
                  <SelectValue placeholder="Hamısı" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün Bloklar</SelectItem>
                  {filteredBlocks.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 rounded-xl text-sm bg-background">
                  <SelectValue placeholder="Hamısı" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün Statuslar</SelectItem>
                  <SelectItem value={ApartmentStatus.available}>Boş</SelectItem>
                  <SelectItem value={ApartmentStatus.sold}>Satılıb</SelectItem>
                  <SelectItem value={ApartmentStatus.reserved}>Rezerv</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Otaq sayı</p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip label="Hamısı" active={filterRooms === "all"} onClick={() => setFilterRooms("all")} />
                {uniqueRooms.map(r => (
                  <FilterChip key={r} label={`${r} otaq`} active={filterRooms === r.toString()} onClick={() => setFilterRooms(filterRooms === r.toString() ? "all" : r.toString())} />
                ))}
              </div>
            </div>
          </div>

          {uniqueFloors.length > 0 && (
            <div className="space-y-1 border-t border-border/40 pt-3">
              <p className="text-xs text-muted-foreground font-medium">
                Mərtəbə
                {filterFloors.size > 0 && (
                  <span className="ml-2 text-primary">({filterFloors.size} seçilib)</span>
                )}
                <span className="ml-2 text-xs text-muted-foreground/60 font-normal">— birdən çox seçə bilərsiniz</span>
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {uniqueFloors.map(f => (
                  <FilterChip
                    key={f}
                    label={`${f}-ci`}
                    active={filterFloors.has(f)}
                    onClick={() => toggleFloor(f)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead>Mənzil №</TableHead>
                  <TableHead>Mərtəbə</TableHead>
                  <TableHead>Otaq</TableHead>
                  <TableHead>Sahə</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-muted-foreground">
                      {hasActiveFilters ? "Seçilmiş filterlərə uyğun mənzil tapılmadı" : "Məlumat tapılmadı"}
                    </TableCell>
                  </TableRow>
                ) : (
                  apartments.map((apt) => (
                    <TableRow key={apt.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">#{apt.id}</TableCell>
                      <TableCell className="font-semibold text-foreground">{apt.blockName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-bold">
                          <Home className="w-4 h-4 text-primary/70" /> {apt.number}
                        </div>
                      </TableCell>
                      <TableCell>{apt.floor}-ci mərtəbə</TableCell>
                      <TableCell className="font-medium">{apt.rooms} otaq</TableCell>
                      <TableCell className="font-medium">{formatArea(apt.area)}</TableCell>
                      <TableCell><StatusBadge status={apt.status} type="apartment" /></TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(apt)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Mənzili Redaktə et" onSave={handleSaveApartment}>
        {editingApt && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
              {editingApt.blockName} — Mənzil #{editingApt.number}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mənzil №</label>
                <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)}
                  className="rounded-xl h-11" placeholder="Məs: 15, 2A..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mərtəbə</label>
                <Input type="number" value={editFloor} onChange={(e) => setEditFloor(e.target.value)}
                  className="rounded-xl h-11" min="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Otaq Sayı</label>
                <Input type="number" value={editRooms} onChange={(e) => setEditRooms(e.target.value)}
                  className="rounded-xl h-11" min="1" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sahə (m²)</label>
                <Input type="number" step="0.01" value={editArea} onChange={(e) => setEditArea(e.target.value)}
                  className="rounded-xl h-11" min="1" />
              </div>
            </div>
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
