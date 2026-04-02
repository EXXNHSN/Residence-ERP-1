import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useCreateObject, useListBlocks, useListTariffs, ObjectType, ObjectStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Store, MapPin, Building2, Car, Settings2, Layers, CheckCircle2, Lock, Key } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatArea, formatCurrency } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function GarageSpotCard({ spot, onAction }: { spot: any; onAction: (spot: any) => void }) {
  const colors: Record<string, string> = {
    available: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer",
    sold: "bg-rose-50 border-rose-200 text-rose-700 cursor-default opacity-80",
    rented: "bg-indigo-50 border-indigo-200 text-indigo-700 cursor-default opacity-80",
  };
  const icons: Record<string, any> = { available: CheckCircle2, sold: Lock, rented: Key };
  const Icon = icons[spot.status] ?? Car;

  return (
    <button onClick={() => onAction(spot)} disabled={spot.status !== "available"}
      className={`rounded-xl border-2 p-2.5 text-left transition-all ${colors[spot.status] ?? "bg-muted border-border"}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" />
        <span className="text-xs font-bold">{spot.number}</span>
      </div>
      <div className="text-xs opacity-60">{spot.status === "available" ? "Boş" : spot.status === "sold" ? "Satılıb" : "İcarədə"}</div>
    </button>
  );
}

export default function ObjectsPage() {
  const [tab, setTab] = useState<"objects" | "garages">("objects");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterKvartal, setFilterKvartal] = useState("all");
  const [filterBlock, setFilterBlock] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupKvartal, setSetupKvartal] = useState("all");
  const [setupBlock, setSetupBlock] = useState("");
  const [setupSpots, setSetupSpots] = useState("10");
  const [setupLoading, setSetupLoading] = useState(false);

  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allObjects, isLoading } = useListObjects({
    type: tab === "objects" ? ObjectType.object : ObjectType.garage,
    status: filterStatus !== "all" ? filterStatus as ObjectStatus : undefined,
  });
  const { data: blocks } = useListBlocks();
  const { data: tariffs } = useListTariffs();

  const { mutate: createObj, isPending } = useCreateObject({
    mutation: {
      onSuccess: () => { setIsOpen(false); reset(); queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() }); }
    }
  });

  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: { type: ObjectType.object, number: "", area: "", blockId: "", activityType: "" }
  });

  const watchedType = watch("type");

  const onSubmit = (data: any) => {
    createObj({ data: { type: data.type, number: data.number, area: Number(data.area), blockId: data.blockId ? Number(data.blockId) : undefined, activityType: data.activityType || undefined } as any });
  };

  // Kvartal/Block grouping for garages
  const uniqueKvartals = useMemo(() => {
    if (!blocks) return [];
    const seen = new Map<string, { id: number; name: string }>();
    blocks.forEach(b => { if (b.quarterId && b.quarterName) seen.set(b.quarterName, { id: b.quarterId, name: b.quarterName }); });
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
    if (!allObjects || tab !== "garages") return [];
    return allObjects.filter((o: any) => {
      if (filterBlock !== "all" && o.blockId?.toString() !== filterBlock) return false;
      if (filterKvartal !== "all" && filterBlock === "all") {
        const block = blocks?.find(b => b.id === o.blockId);
        if (!block || block.quarterId?.toString() !== filterKvartal) return false;
      }
      return true;
    });
  }, [allObjects, tab, filterKvartal, filterBlock, blocks]);

  const floor1 = useMemo(() => garages.filter((g: any) => g.parkingFloor === 1 || (!g.parkingFloor)), [garages]);
  const floor2 = useMemo(() => garages.filter((g: any) => g.parkingFloor === 2), [garages]);
  const hasFloorData = garages.some((g: any) => g.parkingFloor);

  const garageStats = useMemo(() => ({
    total: garages.length,
    available: garages.filter((g: any) => g.status === "available").length,
    sold: garages.filter((g: any) => g.status === "sold").length,
    rented: garages.filter((g: any) => g.status === "rented").length,
  }), [garages]);

  function handleSpotAction(_spot: any) {
    toast({ title: "Satış/İcarə", description: "Qaraj satışı üçün Satışlar → Yeni Satış, icarə üçün İcarə menyusuna keçin." });
  }

  async function handleGarageSetup() {
    if (!setupBlock || !setupSpots) { toast({ title: "Xəta", description: "Blok seçin", variant: "destructive" }); return; }
    setSetupLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/objects/garage-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: Number(setupBlock), spotsPerFloor: Number(setupSpots), floors: 2 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Xəta");
      const result = await res.json();
      toast({ title: "Uğurlu", description: `${result.count} dayanacaq yeri yaradıldı` });
      queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
      setSetupOpen(false);
      const block = blocks?.find(b => b.id.toString() === setupBlock);
      if (block) { setFilterBlock(setupBlock); setFilterKvartal(block.quarterId?.toString() ?? "all"); }
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally { setSetupLoading(false); }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Aktivlər</h1>
            <p className="text-muted-foreground mt-1">Ticarət obyektləri və dayanacaq yerlərinin idarəsi</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "objects" && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl px-5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4 mr-1.5" /> Yeni Obyekt
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader><DialogTitle className="text-xl font-display">Yeni Ticarət Obyekti</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nömrə / Ad</label>
                      <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: Obyekt 1A" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sahə (m²)</label>
                      <Input type="number" step="0.01" {...register("area", { required: true })} className="rounded-xl h-11" placeholder="Məs: 120" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Yerləşdiyi Blok (1-ci mərtəbə)</label>
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
                      <Input {...register("activityType")} className="rounded-xl h-11" placeholder="Məs: Ərzaq mağazası, Apteka..." />
                    </div>
                    <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl">
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {tab === "garages" && isAdmin && (
              <Button onClick={() => setSetupOpen(true)} className="rounded-xl px-5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Settings2 className="w-4 h-4 mr-1.5" /> Qaraj Qurğusu
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
          <button onClick={() => { setTab("objects"); setFilterStatus("all"); setFilterKvartal("all"); setFilterBlock("all"); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "objects" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Store className="w-4 h-4" /> Ticarət Obyektləri
          </button>
          <button onClick={() => { setTab("garages"); setFilterStatus("all"); setFilterKvartal("all"); setFilterBlock("all"); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "garages" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Car className="w-4 h-4" /> Qarajlar / Dayanacaq
          </button>
        </div>

        {/* ── Objects Tab ── */}
        {tab === "objects" && (
          <>
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] rounded-xl bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün Statuslar</SelectItem>
                  <SelectItem value={ObjectStatus.available}>Boş</SelectItem>
                  <SelectItem value={ObjectStatus.sold}>Satılıb</SelectItem>
                  <SelectItem value={ObjectStatus.rented}>İcarədə</SelectItem>
                </SelectContent>
              </Select>
              {tariffs && (
                <span className="text-xs text-muted-foreground ml-2">1 m² = {formatCurrency(tariffs.objectPricePerSqm)}</span>
              )}
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
              {isLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-14">ID</TableHead>
                      <TableHead>Nömrə / Ad</TableHead>
                      <TableHead>Blok / Kvartal</TableHead>
                      <TableHead>Fəaliyyət</TableHead>
                      <TableHead>Sahə</TableHead>
                      <TableHead>Satış Qiyməti</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allObjects?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Store className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p>Ticarət obyekti tapılmadı</p>
                        </TableCell>
                      </TableRow>
                    ) : allObjects?.map((obj: any) => (
                      <TableRow key={obj.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-muted-foreground text-xs">#{obj.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-bold">
                            <Store className="w-4 h-4 text-primary/70" /> {obj.number}
                          </div>
                        </TableCell>
                        <TableCell>
                          {obj.blockName ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Building2 className="w-3.5 h-3.5 text-primary/70" /> {obj.blockName}
                              </div>
                              {obj.quarterName && (
                                <Badge variant="outline" className="gap-1 text-xs font-normal">
                                  <MapPin className="w-3 h-3" /> {obj.quarterName}
                                </Badge>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">{obj.activityType || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="font-medium">{formatArea(obj.area)}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCurrency(obj.salePrice)}</TableCell>
                        <TableCell><StatusBadge status={obj.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}

        {/* ── Garages Tab ── */}
        {tab === "garages" && (
          <>
            {/* Pricing info */}
            {tariffs && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Sabit satış:</span>
                <span className="font-bold">{formatCurrency((tariffs as any).garageSalePrice ?? 5000)}</span>
                <span className="text-border">·</span>
                <span className="text-muted-foreground">Aylıq icarə:</span>
                <span className="font-bold">{formatCurrency((tariffs as any).garageMonthlyRent ?? 100)} / ay</span>
                <span className="text-border">·</span>
                <Link href="/tariffs" className="text-xs text-primary hover:underline">Qiyməti dəyişdir</Link>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Cəmi", value: garageStats.total, color: "text-foreground", bg: "bg-card" },
                { label: "Boş", value: garageStats.available, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Satılıb", value: garageStats.sold, color: "text-rose-600", bg: "bg-rose-50" },
                { label: "İcarədə", value: garageStats.rented, color: "text-indigo-600", bg: "bg-indigo-50" },
              ].map(s => (
                <Card key={s.label} className={`border-none shadow-md ${s.bg}`}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <Car className={`w-5 h-5 ${s.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] rounded-xl bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün Statuslar</SelectItem>
                  <SelectItem value="available">Boş</SelectItem>
                  <SelectItem value="sold">Satılıb</SelectItem>
                  <SelectItem value="rented">İcarədə</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Garage spots */}
            {isLoading ? (
              <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : garages.length === 0 ? (
              <Card className="border-none shadow-lg shadow-black/5">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Car className="w-12 h-12 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-medium">Bu filterlər üçün dayanacaq yeri tapılmadı</p>
                  {isAdmin && filterBlock !== "all" && (
                    <Button onClick={() => setSetupOpen(true)} variant="outline" className="mt-4 rounded-xl">
                      <Settings2 className="w-4 h-4 mr-2" /> Bu blok üçün qaraj yarat
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : hasFloorData ? (
              <div className="space-y-4">
                {[{ label: "Yer altı 1-ci mərtəbə (M1)", spots: floor1, color: "text-primary" },
                  ...(floor2.length > 0 ? [{ label: "Yer altı 2-ci mərtəbə (M2)", spots: floor2, color: "text-violet-500" }] : [])
                ].map(({ label, spots, color }) => (
                  <Card key={label} className="border-none shadow-lg shadow-black/5">
                    <CardHeader className="border-b border-border/50 pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className={`w-4 h-4 ${color}`} /> {label}
                        <Badge variant="outline" className="ml-1 text-xs">{spots.length} yer</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-14 gap-2">
                        {spots.map((spot: any) => <GarageSpotCard key={spot.id} spot={spot} onAction={handleSpotAction} />)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nömrə</TableHead>
                      <TableHead>Blok</TableHead>
                      <TableHead>Kvartal</TableHead>
                      <TableHead>Satış Qiyməti</TableHead>
                      <TableHead>Aylıq İcarə</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garages.map((g: any) => (
                      <TableRow key={g.id} className="hover:bg-muted/30">
                        <TableCell className="font-bold flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-muted-foreground" />{g.number}</TableCell>
                        <TableCell>{g.blockName || "—"}</TableCell>
                        <TableCell>{g.quarterName ? <Badge variant="outline" className="text-xs">{g.quarterName}</Badge> : "—"}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCurrency(g.salePrice)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatCurrency(g.monthlyRent)} / ay</TableCell>
                        <TableCell><StatusBadge status={g.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Legend */}
            {garages.length > 0 && (
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Boş</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-200 inline-block" /> Satılıb</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> İcarədə</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Garage Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> Qaraj Qurğusu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-primary/5 rounded-xl p-3 text-sm text-muted-foreground">
              Seçdiyiniz blok üçün <strong>2 mərtəbəli</strong> dayanacaq yeri avtomatik yaradılacaq.
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
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name} {b.quarterName ? `(${b.quarterName})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hər mərtəbədə yer sayı</label>
              <Input type="number" min="1" max="50" value={setupSpots} onChange={e => setSetupSpots(e.target.value)} className="rounded-xl h-11" />
              <p className="text-xs text-muted-foreground">Cəmi: {Number(setupSpots) * 2} yer (2 mərtəbə × {setupSpots})</p>
            </div>
            <Button onClick={handleGarageSetup} disabled={setupLoading || !setupBlock} className="w-full h-12 rounded-xl">
              {setupLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Car className="w-5 h-5 mr-2" />}
              {Number(setupSpots) * 2} Dayanacaq Yeri Yarat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
