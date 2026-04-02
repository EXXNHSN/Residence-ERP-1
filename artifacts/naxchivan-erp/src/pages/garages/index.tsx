import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useListBlocks, useListTariffs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Settings2, Loader2, Building2, CheckCircle2, Lock, Key, Layers, Trash2, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function SpotCard({ spot, onAction, deleteMode, onDelete }: {
  spot: any;
  onAction: (spot: any) => void;
  deleteMode?: boolean;
  onDelete?: (spot: any) => void;
}) {
  const colors: Record<string, string> = {
    available: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    sold: "bg-rose-50 border-rose-200 text-rose-700",
    rented: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  const icons: Record<string, any> = {
    available: CheckCircle2,
    sold: Lock,
    rented: Key,
  };
  const Icon = icons[spot.status] ?? Car;

  if (deleteMode) {
    return (
      <button
        onClick={() => onDelete?.(spot)}
        className="rounded-xl border-2 p-3 text-left transition-all cursor-pointer bg-red-50 border-red-200 text-red-600 hover:bg-red-100 relative group"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Trash2 className="w-3.5 h-3.5 opacity-70" />
          <span className="text-xs font-bold">{spot.number}</span>
        </div>
        <div className="text-xs opacity-70">
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
        <Icon className="w-3.5 h-3.5" />
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
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSpot, setDeleteSpot] = useState<any | null>(null);

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupKvartal, setSetupKvartal] = useState("all");
  const [setupBlock, setSetupBlock] = useState("");
  const [setupSpots, setSetupSpots] = useState("10");
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

  const floor1 = useMemo(() => filteredGarages.filter((g: any) => g.parkingFloor === 1 || (!g.parkingFloor && true)), [filteredGarages]);
  const floor2 = useMemo(() => filteredGarages.filter((g: any) => g.parkingFloor === 2), [filteredGarages]);
  const hasFloorData = filteredGarages.some((g: any) => g.parkingFloor);

  const stats = useMemo(() => ({
    total: filteredGarages.length,
    available: filteredGarages.filter((g: any) => g.status === "available").length,
    sold: filteredGarages.filter((g: any) => g.status === "sold").length,
    rented: filteredGarages.filter((g: any) => g.status === "rented").length,
  }), [filteredGarages]);

  async function handleSetup() {
    if (!setupBlock || !setupSpots) {
      toast({ title: "Xəta", description: "Blok və yer sayını seçin", variant: "destructive" });
      return;
    }
    setSetupLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/objects/garage-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: Number(setupBlock), spotsPerFloor: Number(setupSpots), floors: 2 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta" }));
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      const result = await res.json();
      toast({ title: "Uğurlu", description: `${result.count} dayanacaq yeri yaradıldı (2 mərtəbə × ${setupSpots} yer)` });
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

  async function handleDeleteSpot(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/objects/${deleteSpot.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: adminPassword }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Silmə xətası"); }
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
    toast({ title: `${deleteSpot.number} silindi` });
    setDeleteSpot(null);
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
            onDelete={setDeleteSpot}
          />
        ))}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Avto Dayanacaq</h1>
            <p className="text-muted-foreground mt-1">Blok altı 2 mərtəbəli avtomobil dayanacaqları</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant={deleteMode ? "destructive" : "outline"}
                onClick={() => setDeleteMode(d => !d)}
                className="rounded-xl px-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMode ? "Silmə Rejimindən Çıx" : "Yer Sil"}
              </Button>
              <Button onClick={() => setSetupOpen(true)} className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Settings2 className="w-4 h-4 mr-2" /> Yeni Qurğu
              </Button>
            </div>
          )}
        </div>

        {/* Delete mode banner */}
        {deleteMode && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span><strong>Silmə rejimi aktiv.</strong> Silmək istədiyiniz dayanacaq yerinə klikləyin. Admin şifrəsi tələb olunacaq.</span>
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
            <SelectTrigger className="w-[160px] rounded-xl bg-card">
              <SelectValue placeholder="Kvartal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Kvartallar</SelectItem>
              {uniqueKvartals.map(q => (
                <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-[180px] rounded-xl bg-card">
              <SelectValue placeholder="Blok" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Bloklar</SelectItem>
              {filteredBlocksForFilter.map(b => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.name} {b.quarterName ? `(${b.quarterName})` : ""}
                </SelectItem>
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

        {/* Garage spots display */}
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
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Yer altı 1-ci mərtəbə (M1)
                  <Badge variant="outline" className="ml-2 text-xs">{floor1.length} yer</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">{renderSpotGrid(floor1)}</CardContent>
            </Card>

            {floor2.length > 0 && (
              <Card className="border-none shadow-lg shadow-black/5">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-500" />
                    Yer altı 2-ci mərtəbə (M2)
                    <Badge variant="outline" className="ml-2 text-xs">{floor2.length} yer</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">{renderSpotGrid(floor2)}</CardContent>
              </Card>
            )}
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
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Boş (klik ilə satış/icarəyə yönləndirir)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-200 inline-block" /> Satılıb</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> İcarədə</span>
          </div>
        )}
      </div>

      {/* Delete spot dialog */}
      <AdminEditDialog
        open={!!deleteSpot}
        onClose={() => setDeleteSpot(null)}
        title={`Silinsin: ${deleteSpot?.number ?? ""}`}
        saveLabel="Sil"
        saveVariant="destructive"
        onSave={handleDeleteSpot}
      >
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>{deleteSpot?.number}</strong> dayanacaq yeri silinəcək.
          {deleteSpot?.status !== "available" && (
            <div className="mt-2 font-semibold">
              ⚠️ Bu yer hal-hazırda <em>{deleteSpot?.status === "sold" ? "satılıb" : "icarədədir"}</em>. Silinmədən əvvəl bağlı qeydlər yoxlanılmalıdır.
            </div>
          )}
        </div>
      </AdminEditDialog>

      {/* Garage Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> Avto Dayanacaq Qurğusu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="bg-primary/5 rounded-xl p-4 text-sm text-muted-foreground">
              Seçdiyiniz blok üçün <strong>2 mərtəbəli</strong> dayanacaq yeri avtomatik yaradılacaq.
              Hər mərtəbədə eyni sayda yer olacaq.
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kvartal</label>
              <Select value={setupKvartal} onValueChange={v => { setSetupKvartal(v); setSetupBlock(""); }}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Kvartal seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün kvartallar</SelectItem>
                  {uniqueKvartals.map(q => (
                    <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>
                  ))}
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Hər mərtəbədə yer sayı</label>
              <Input type="number" min="1" max="50" value={setupSpots}
                onChange={e => setSetupSpots(e.target.value)} className="rounded-xl h-11" placeholder="Məs: 10" />
              <p className="text-xs text-muted-foreground">
                Cəmi: {Number(setupSpots) * 2} yer (2 mərtəbə × {setupSpots})
              </p>
            </div>

            <Button onClick={handleSetup} disabled={setupLoading || !setupBlock} className="w-full h-12 rounded-xl">
              {setupLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Car className="w-5 h-5 mr-2" />}
              {setupLoading ? "Yaradılır..." : `${Number(setupSpots) * 2} Dayanacaq Yeri Yarat`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
