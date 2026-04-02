import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useListBlocks, useListTariffs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Settings2, Loader2, Building2, CheckCircle2, Lock, Key, Layers, Trash2, ShieldAlert, CheckSquare, Square } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function SpotCard({
  spot,
  onAction,
  deleteMode,
  selected,
  onToggleSelect,
}: {
  spot: any;
  onAction: (spot: any) => void;
  deleteMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (spot: any) => void;
}) {
  const colors: Record<string, string> = {
    available: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    sold: "bg-rose-50 border-rose-200 text-rose-700",
    rented: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  const statusIcons: Record<string, any> = {
    available: CheckCircle2,
    sold: Lock,
    rented: Key,
  };
  const StatusIcon = statusIcons[spot.status] ?? Car;

  if (deleteMode) {
    return (
      <button
        onClick={() => onToggleSelect?.(spot)}
        className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer relative ${
          selected
            ? "bg-red-100 border-red-500 text-red-700 shadow-sm shadow-red-200"
            : "bg-muted/40 border-border text-muted-foreground hover:bg-red-50 hover:border-red-300 hover:text-red-600"
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          {selected
            ? <CheckSquare className="w-3 h-3 text-red-600 flex-shrink-0" />
            : <Square className="w-3 h-3 opacity-40 flex-shrink-0" />}
          <span className="text-xs font-bold truncate">{spot.number}</span>
        </div>
        <div className="text-xs opacity-60">
          {spot.status === "available" ? "Boş" : spot.status === "sold" ? "Satılıb" : "İcarədə"}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onAction(spot)}
      disabled={spot.status !== "available"}
      className={`rounded-xl border-2 p-3 text-left transition-all group ${colors[spot.status] ?? "bg-muted border-border"} ${spot.status === "available" ? "cursor-pointer" : "cursor-default opacity-80"}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs font-bold">{spot.number}</span>
      </div>
      <div className="text-xs opacity-70">
        {spot.status === "available" ? "Boş" : spot.status === "sold" ? "Satılıb" : "İcarədə"}
      </div>
    </button>
  );
}

export default function GaragesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allObjects, isLoading } = useListObjects({ type: "garage" } as any);
  const { data: blocks } = useListBlocks();
  const { data: tariffs } = useListTariffs();

  const [filterKvartal, setFilterKvartal] = useState("all");
  const [filterBlock, setFilterBlock] = useState("all");

  // Delete mode state
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Setup dialog state
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupKvartal, setSetupKvartal] = useState("all");
  const [setupBlock, setSetupBlock] = useState("");
  const [setupSpots, setSetupSpots] = useState("10");
  const [setupFloors, setSetupFloors] = useState("2");
  const [setupLoading, setSetupLoading] = useState(false);

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

  const filteredBlocksForFilter = useMemo(() => {
    if (!blocks) return [];
    if (filterKvartal === "all") return blocks;
    return blocks.filter(b => b.quarterId?.toString() === filterKvartal);
  }, [blocks, filterKvartal]);

  const filteredBlocksForSetup = useMemo(() => {
    if (!blocks) return [];
    if (setupKvartal === "all") return blocks;
    return blocks.filter(b => b.quarterId?.toString() === setupKvartal);
  }, [blocks, setupKvartal]);

  const garages = useMemo(() => {
    if (!allObjects) return [];
    return allObjects.filter((o: any) => o.type === "garage");
  }, [allObjects]);

  const filteredGarages = useMemo(() => {
    return garages.filter((g: any) => {
      if (filterBlock !== "all" && g.blockId?.toString() !== filterBlock) return false;
      if (filterKvartal !== "all" && filterBlock === "all") {
        const block = blocks?.find(b => b.id === g.blockId);
        if (!block || block.quarterId?.toString() !== filterKvartal) return false;
      }
      return true;
    });
  }, [garages, filterKvartal, filterBlock, blocks]);

  // Group by floor
  const floorGroups = useMemo(() => {
    const map = new Map<number, any[]>();
    filteredGarages.forEach((g: any) => {
      const floor = g.parkingFloor ?? 1;
      const arr = map.get(floor) ?? [];
      arr.push(g);
      map.set(floor, arr);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filteredGarages]);

  const hasFloorData = filteredGarages.some((g: any) => g.parkingFloor);

  const stats = useMemo(() => ({
    total: filteredGarages.length,
    available: filteredGarages.filter((g: any) => g.status === "available").length,
    sold: filteredGarages.filter((g: any) => g.status === "sold").length,
    rented: filteredGarages.filter((g: any) => g.status === "rented").length,
  }), [filteredGarages]);

  function toggleSelect(spot: any) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(spot.id)) next.delete(spot.id);
      else next.add(spot.id);
      return next;
    });
  }

  function enterDeleteMode() {
    setDeleteMode(true);
    setSelectedIds(new Set());
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }

  function selectAll() {
    setSelectedIds(new Set(filteredGarages.map((g: any) => g.id)));
  }

  async function handleSetup() {
    if (!setupBlock || !setupSpots) {
      toast({ title: "Xəta", description: "Blok və yer sayını seçin", variant: "destructive" });
      return;
    }
    setSetupLoading(true);
    try {
      const floors = Math.max(1, Math.min(10, Number(setupFloors) || 2));
      const res = await fetch(`${BASE()}/api/objects/garage-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: Number(setupBlock), spotsPerFloor: Number(setupSpots), floors }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta" }));
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      const result = await res.json();
      toast({ title: "Uğurlu", description: `${result.count} dayanacaq yeri yaradıldı (${floors} mərtəbə × ${setupSpots} yer)` });
      queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
      setSetupOpen(false);
      const block = blocks?.find(b => b.id.toString() === setupBlock);
      if (block) {
        setFilterBlock(setupBlock);
        setFilterKvartal(block.quarterId?.toString() ?? "all");
      }
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setSetupLoading(false);
    }
  }

  function handleSpotAction(spot: any) {
    toast({ title: `${spot.number} seçildi`, description: "Satış üçün Satışlar → Yeni Satış, İcarə üçün İcarə menyusuna keçin." });
  }

  async function handleBulkDelete(adminPassword: string) {
    const ids = [...selectedIds];
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(`${BASE()}/api/objects/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: adminPassword }),
      });
      if (!res.ok) failed++;
    }
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
    if (failed > 0) {
      toast({ title: `${ids.length - failed} silindi`, description: `${failed} yer silinəmədi (bağlı qeydlər ola bilər)`, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} dayanacaq yeri silindi` });
    }
    exitDeleteMode();
  }

  function renderSpotGrid(spots: any[]) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {spots.map((spot: any) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            onAction={handleSpotAction}
            deleteMode={deleteMode}
            selected={selectedIds.has(spot.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>
    );
  }

  const totalSpots = Number(setupSpots) * Number(setupFloors || 2);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Avto Dayanacaq</h1>
            <p className="text-muted-foreground mt-1">Blok altı çoxmərtəbəli avtomobil dayanacaqları</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              {!deleteMode ? (
                <>
                  <Button variant="outline" onClick={enterDeleteMode} className="rounded-xl px-4 border-destructive/40 text-destructive hover:bg-destructive/5">
                    <Trash2 className="w-4 h-4 mr-2" /> Yer Sil
                  </Button>
                  <Button onClick={() => setSetupOpen(true)} className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                    <Settings2 className="w-4 h-4 mr-2" /> Yeni Qurğu
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground mr-1">{selectedIds.size} seçildi</span>
                  {selectedIds.size < filteredGarages.length && (
                    <Button variant="outline" size="sm" onClick={selectAll} className="rounded-xl">
                      Hamısını seç
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="rounded-xl px-4"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> {selectedIds.size > 0 ? `${selectedIds.size} Yeri Sil` : "Yer Sil"}
                  </Button>
                  <Button variant="ghost" onClick={exitDeleteMode} className="rounded-xl px-4">
                    Ləğv et
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Delete mode banner */}
        {deleteMode && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>
              <strong>Silmə rejimi aktiv.</strong> Silmək istədiyiniz dayanacaq yerlərini klikləyərək seçin, sonra "Sil" düyməsinə basın.
            </span>
          </div>
        )}

        {/* Pricing info */}
        {tariffs && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Satış qiyməti:</span>
            <span className="font-bold text-foreground">{formatCurrency((tariffs as any).garageSalePrice ?? 5000)}</span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Aylıq İcarə:</span>
            <span className="font-bold text-foreground">{formatCurrency((tariffs as any).garageMonthlyRent ?? 100)} / ay</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterKvartal} onValueChange={v => { setFilterKvartal(v); setFilterBlock("all"); }}>
            <SelectTrigger className="w-[160px] rounded-xl bg-card"><SelectValue placeholder="Kvartal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Kvartallar</SelectItem>
              {uniqueKvartals.map(q => <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-[180px] rounded-xl bg-card"><SelectValue placeholder="Blok" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Bloklar</SelectItem>
              {filteredBlocksForFilter.map(b => (
                <SelectItem key={b.id} value={b.id.toString()}>{b.name} {b.quarterName ? `(${b.quarterName})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterKvartal !== "all" || filterBlock !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 rounded-xl text-muted-foreground"
              onClick={() => { setFilterKvartal("all"); setFilterBlock("all"); }}>
              Sıfırla
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Cəmi", value: stats.total, color: "text-foreground", bg: "bg-card" },
            { label: "Boş", value: stats.available, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Satılıb", value: stats.sold, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "İcarədə", value: stats.rented, color: "text-indigo-600", bg: "bg-indigo-50" },
          ].map(s => (
            <Card key={s.label} className={`border-none shadow-md ${s.bg}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <Car className={`w-6 h-6 ${s.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Garage spots */}
        {isLoading ? (
          <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredGarages.length === 0 ? (
          <Card className="border-none shadow-lg shadow-black/5">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Car className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">Bu blokda dayanacaq yeri yoxdur</p>
              {isAdmin && (
                <Button onClick={() => setSetupOpen(true)} variant="outline" className="mt-4 rounded-xl">
                  <Settings2 className="w-4 h-4 mr-2" /> Avto Dayanacaq yarat
                </Button>
              )}
            </CardContent>
          </Card>
        ) : hasFloorData ? (
          <div className="space-y-4">
            {floorGroups.map(([floor, spots]) => (
              <Card key={floor} className="border-none shadow-lg shadow-black/5">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className={`w-4 h-4 ${floor === 1 ? "text-primary" : floor === 2 ? "text-violet-500" : "text-amber-500"}`} />
                    {floor === 1 ? "Yer altı 1-ci mərtəbə" : floor === 2 ? "Yer altı 2-ci mərtəbə" : `${floor}-ci mərtəbə`}
                    <span className="text-muted-foreground font-normal">(M{floor})</span>
                    <Badge variant="outline" className="ml-2 text-xs">{spots.length} yer</Badge>
                    {deleteMode && (
                      <button
                        onClick={() => {
                          const floorIds = new Set(spots.map((s: any) => s.id));
                          const allSelected = spots.every((s: any) => selectedIds.has(s.id));
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allSelected) floorIds.forEach(id => next.delete(id));
                            else floorIds.forEach(id => next.add(id));
                            return next;
                          });
                        }}
                        className="ml-auto text-xs text-red-500 hover:underline font-normal"
                      >
                        {spots.every((s: any) => selectedIds.has(s.id)) ? "Hamısını çıxar" : "Hamısını seç"}
                      </button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">{renderSpotGrid(spots)}</CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const byBlock = new Map<string, any[]>();
              filteredGarages.forEach((g: any) => {
                const key = g.blockId ? `${g.blockName ?? g.blockId} (${g.quarterName ?? ""})` : "Bloksuz";
                const arr = byBlock.get(key) ?? [];
                arr.push(g);
                byBlock.set(key, arr);
              });
              return [...byBlock.entries()].map(([blockLabel, spots]) => (
                <Card key={blockLabel} className="border-none shadow-lg shadow-black/5">
                  <CardHeader className="border-b border-border/50 pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      {blockLabel}
                      <Badge variant="outline" className="ml-2 text-xs">{spots.length} yer</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">{renderSpotGrid(spots)}</CardContent>
                </Card>
              ));
            })()}
          </div>
        )}

        {/* Legend */}
        {filteredGarages.length > 0 && !deleteMode && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Boş</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-200 inline-block" /> Satılıb</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> İcarədə</span>
          </div>
        )}
      </div>

      {/* ── Bulk Delete Confirmation ── */}
      <AdminEditDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`${selectedIds.size} Dayanacaq Yeri Silinsin?`}
        saveLabel={`${selectedIds.size} Yeri Sil`}
        saveVariant="destructive"
        onSave={handleBulkDelete}
      >
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 space-y-2">
          <p><strong>{selectedIds.size} dayanacaq yeri</strong> silinəcək. Bu əməliyyat geri qaytarıla bilməz.</p>
          {(() => {
            const selected = filteredGarages.filter((g: any) => selectedIds.has(g.id));
            const occupied = selected.filter((g: any) => g.status !== "available");
            if (occupied.length > 0) {
              return (
                <p className="font-semibold">
                  ⚠️ {occupied.length} yer hal-hazırda satılıb və ya icarədədir. Bu yerlərin silinməsi bağlı qeydləri poza bilər.
                </p>
              );
            }
            return null;
          })()}
        </div>
      </AdminEditDialog>

      {/* ── Garage Setup Dialog ── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> Avto Dayanacaq Qurğusu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="bg-primary/5 rounded-xl p-4 text-sm text-muted-foreground">
              Seçdiyiniz blok üçün dayanacaq yerləri avtomatik yaradılacaq.
              <strong className="text-foreground ml-1">Mövcud yerlər dəyişdirilmir.</strong>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kvartal</label>
              <Select value={setupKvartal} onValueChange={v => { setSetupKvartal(v); setSetupBlock(""); }}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Kvartal seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün kvartallar</SelectItem>
                  {uniqueKvartals.map(q => <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Blok</label>
              <Select value={setupBlock} onValueChange={setSetupBlock}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Blok seçin..." /></SelectTrigger>
                <SelectContent>
                  {filteredBlocksForSetup.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name} {b.quarterName ? `(${b.quarterName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Floors + Spots per floor — side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mərtəbə sayı</label>
                <Input
                  type="number" min="1" max="10"
                  value={setupFloors}
                  onChange={e => setSetupFloors(e.target.value)}
                  className="rounded-xl h-11"
                  placeholder="Məs: 2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hər mərtəbədə yer</label>
                <Input
                  type="number" min="1" max="100"
                  value={setupSpots}
                  onChange={e => setSetupSpots(e.target.value)}
                  className="rounded-xl h-11"
                  placeholder="Məs: 10"
                />
              </div>
            </div>

            {/* Summary */}
            {setupFloors && setupSpots && (
              <div className="bg-muted/40 rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center justify-between">
                <span>Cəmi yaranacaq yer:</span>
                <span className="font-bold text-foreground text-base">{totalSpots}</span>
              </div>
            )}

            <Button onClick={handleSetup} disabled={setupLoading || !setupBlock} className="w-full h-12 rounded-xl">
              {setupLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Car className="w-5 h-5 mr-2" />}
              {setupLoading ? "Yaradılır..." : `${totalSpots} Dayanacaq Yeri Yarat`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
