import { AppLayout } from "@/components/layout/AppLayout";
import { useListTariffs, useUpdateTariffs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTariffsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

type FloorTier = { id: number; floorFrom: number; floorTo: number; pricePerSqm: number };

function AdminConfirmField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 pt-3 border-t border-border/50">
      <label className="text-xs font-medium text-muted-foreground">Admin Şifrəsi</label>
      <Input
        type="password"
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl h-10"
      />
    </div>
  );
}

export default function TariffsPage() {
  const { data: tariffs, isLoading } = useListTariffs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      communalTariff: "",
      apartmentPricePerSqm: "",
      objectPricePerSqm: "",
      garagePricePerSqm: "",
      garageSalePrice: "",
      garageMonthlyRent: "",
    }
  });

  useEffect(() => {
    if (tariffs) {
      reset({
        communalTariff: tariffs.communalTariff.toString(),
        apartmentPricePerSqm: tariffs.apartmentPricePerSqm.toString(),
        objectPricePerSqm: tariffs.objectPricePerSqm.toString(),
        garagePricePerSqm: tariffs.garagePricePerSqm.toString(),
        garageSalePrice: ((tariffs as any).garageSalePrice ?? 5000).toString(),
        garageMonthlyRent: ((tariffs as any).garageMonthlyRent ?? 100).toString(),
      });
    }
  }, [tariffs, reset]);

  const { mutate: updateTariffs, isPending } = useUpdateTariffs({
    mutation: {
      onSuccess: () => {
        toast({ title: "Uğurlu", description: "Tariflər yeniləndi." });
        queryClient.invalidateQueries({ queryKey: getListTariffsQueryKey() });
      }
    }
  });

  const onSubmit = (data: any) => {
    updateTariffs({
      data: {
        communalTariff: Number(data.communalTariff),
        apartmentPricePerSqm: Number(data.apartmentPricePerSqm),
        objectPricePerSqm: Number(data.objectPricePerSqm),
        garagePricePerSqm: Number(data.garagePricePerSqm),
        garageSalePrice: Number(data.garageSalePrice),
        garageMonthlyRent: Number(data.garageMonthlyRent),
      } as any
    });
  };

  const [tiers, setTiers] = useState<FloorTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tierDialog, setTierDialog] = useState<{ open: boolean; mode: "add" | "edit"; tier?: FloorTier }>({ open: false, mode: "add" });
  const [tierFloorFrom, setTierFloorFrom] = useState("");
  const [tierFloorTo, setTierFloorTo] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierAdminPass, setTierAdminPass] = useState("");
  const [tierSaving, setTierSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tier?: FloorTier }>({ open: false });
  const [deletePass, setDeletePass] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadTiers() {
    setTiersLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/floor-price-tiers`);
      const data = await res.json();
      setTiers(Array.isArray(data) ? data : []);
    } catch {
      setTiers([]);
    } finally {
      setTiersLoading(false);
    }
  }

  useEffect(() => { loadTiers(); }, []);

  function openAdd() {
    setTierFloorFrom(""); setTierFloorTo(""); setTierPrice(""); setTierAdminPass("");
    setTierDialog({ open: true, mode: "add" });
  }

  function openEdit(t: FloorTier) {
    setTierFloorFrom(t.floorFrom.toString());
    setTierFloorTo(t.floorTo.toString());
    setTierPrice(t.pricePerSqm.toString());
    setTierAdminPass("");
    setTierDialog({ open: true, mode: "edit", tier: t });
  }

  async function handleSaveTier() {
    if (!tierFloorFrom || !tierFloorTo || !tierPrice || !tierAdminPass) {
      toast({ title: "Xəta", description: "Bütün sahələri doldurun", variant: "destructive" });
      return;
    }
    setTierSaving(true);
    try {
      const body = { username: user?.username, password: tierAdminPass, floorFrom: Number(tierFloorFrom), floorTo: Number(tierFloorTo), pricePerSqm: Number(tierPrice) };
      const url = tierDialog.mode === "edit" ? `${BASE()}/api/floor-price-tiers/${tierDialog.tier!.id}` : `${BASE()}/api/floor-price-tiers`;
      const method = tierDialog.mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta" }));
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      toast({ title: "Uğurlu", description: tierDialog.mode === "edit" ? "Dəyişdirildi" : "Əlavə edildi" });
      setTierDialog({ open: false, mode: "add" });
      loadTiers();
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setTierSaving(false);
    }
  }

  async function handleDeleteTier() {
    if (!deletePass || !deleteDialog.tier) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/floor-price-tiers/${deleteDialog.tier.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user?.username, password: deletePass }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta" }));
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      toast({ title: "Silindi" });
      setDeleteDialog({ open: false });
      setDeletePass("");
      loadTiers();
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  if (isLoading) {
    return <AppLayout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sistem Tənzimləmələri</h1>
          <p className="text-muted-foreground mt-1">Qlobal tariflər və qiymətlərin idarəsi</p>
        </div>

        <Card className="border-none shadow-lg shadow-black/5">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle>Tariflər</CardTitle>
            <CardDescription>Bu qiymətlər yeni satışlar və kommunal hesablamalar zamanı avtomatik tətbiq olunur.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Kommunal Xidmət Tarifi (1 m² üçün aylıq AZN)</label>
                <Input type="number" step="0.01" {...register("communalTariff")} className="rounded-xl h-12 max-w-sm" />
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <h3 className="font-semibold text-lg">Standart Satış Qiymətləri</h3>
                <p className="text-xs text-muted-foreground -mt-2">Mərtəbəyə görə qiymət müəyyən edilməyibsə bu standart qiymət tətbiq olunur.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Mənzil 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("apartmentPricePerSqm")} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Obyekt 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("objectPricePerSqm")} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Avto Dayanacaq 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("garagePricePerSqm")} className="rounded-xl h-12" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span>Avto Dayanacaq Sabit Qiymətləri</span>
                </h3>
                <p className="text-xs text-muted-foreground -mt-2">Avto dayanacaq satışı və icarəsi üçün sabit qiymət (sahəyə görə deyil).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Avto Dayanacaq Satış Qiyməti (AZN)</label>
                    <Input type="number" step="1" {...register("garageSalePrice")} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Avto Dayanacaq Aylıq İcarə (AZN)</label>
                    <Input type="number" step="1" {...register("garageMonthlyRent")} className="rounded-xl h-12" />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" disabled={isPending} className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Yadda Saxla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg shadow-black/5">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Mərtəbəyə görə Mənzil Qiyməti
              </CardTitle>
              <CardDescription className="mt-1">Yeni satış zamanı mənzilin mərtəbəsinə uyğun qiymət avtomatik seçilir.</CardDescription>
            </div>
            <Button onClick={openAdd} size="sm" className="rounded-xl h-9 px-4 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Əlavə et
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {tiersLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : tiers.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Mərtəbə qiyməti əlavə edilməyib.</p>
                <p className="text-xs mt-1">Standart qiymət tətbiq olunacaq.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Mərtəbə aralığı</TableHead>
                    <TableHead className="text-right">1 m² Qiyməti (AZN)</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {t.floorFrom === t.floorTo
                          ? `${t.floorFrom}-ci mərtəbə`
                          : `${t.floorFrom} – ${t.floorTo}-ci mərtəbələr`}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{t.pricePerSqm.toLocaleString("az")} AZN</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(t)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { setDeleteDialog({ open: true, tier: t }); setDeletePass(""); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={tierDialog.open} onOpenChange={(o) => !o && setTierDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tierDialog.mode === "add" ? "Yeni Mərtəbə Qiyməti" : "Qiyməti Dəyişdir"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Başlanğıc mərtəbə</label>
                <Input type="number" min="1" value={tierFloorFrom} onChange={e => setTierFloorFrom(e.target.value)} placeholder="1" className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Son mərtəbə</label>
                <Input type="number" min="1" value={tierFloorTo} onChange={e => setTierFloorTo(e.target.value)} placeholder="5" className="rounded-xl h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">1 m² Qiyməti (AZN)</label>
              <Input type="number" step="0.01" value={tierPrice} onChange={e => setTierPrice(e.target.value)} placeholder="1200" className="rounded-xl h-10" />
            </div>
            <AdminConfirmField value={tierAdminPass} onChange={setTierAdminPass} />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setTierDialog(prev => ({ ...prev, open: false }))}>Ləğv et</Button>
            <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={handleSaveTier} disabled={tierSaving}>
              {tierSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {tierDialog.mode === "add" ? "Əlavə et" : "Yadda saxla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false })}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Qiymət Sil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {deleteDialog.tier && (deleteDialog.tier.floorFrom === deleteDialog.tier.floorTo
                ? `${deleteDialog.tier.floorFrom}-ci mərtəbə`
                : `${deleteDialog.tier?.floorFrom}–${deleteDialog.tier?.floorTo}-ci mərtəbələr`)} üçün qiyməti silinəcək.
            </p>
            <AdminConfirmField value={deletePass} onChange={setDeletePass} />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDialog({ open: false })}>Ləğv et</Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleDeleteTier} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
