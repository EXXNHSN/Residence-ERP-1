import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  useListApartments, 
  useListObjects,
  useListBlocks,
  useCreateSale,
  useCreateCustomer,
  useListTariffs,
  SaleType,
  CreateSaleInputAssetType,
  ApartmentStatus,
  ObjectStatus
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Calculator, User, Search, CheckCircle2, Building2, Layers, SquareStack, X, SlidersHorizontal } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-white border-primary shadow-sm"
          : "bg-white border-border/60 text-muted-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}

export default function CreateSalePage() {
  const [, setLocation] = useLocation();
  const { data: apartments } = useListApartments({ status: ApartmentStatus.available });
  const { data: objects } = useListObjects({ status: ObjectStatus.available });
  const { data: tariffs } = useListTariffs();
  const { data: blocks } = useListBlocks();

  const { mutateAsync: createCustomer } = useCreateCustomer();
  const { mutate: createSale, isPending } = useCreateSale({
    mutation: {
      onSuccess: () => setLocation("/sales")
    }
  });

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      fin: "",
      phone: "",
      address: "",
      assetType: CreateSaleInputAssetType.apartment,
      assetId: "",
      saleType: SaleType.cash,
      pricePerSqm: "",
      downPayment: "0",
      installmentMonths: "12"
    }
  });

  const watchAssetType = watch("assetType");
  const watchAssetId = watch("assetId");
  const watchSaleType = watch("saleType");
  const watchPrice = watch("pricePerSqm");
  const watchDownPayment = watch("downPayment");
  const watchMonths = watch("installmentMonths");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [filterKvartal, setFilterKvartal] = useState("all");
  const [filterBlock, setFilterBlock] = useState("all");
  const [filterFloors, setFilterFloors] = useState<Set<number>>(new Set());
  const [filterRooms, setFilterRooms] = useState("all");

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

  const filteredBlockOptions = useMemo(() => {
    if (!blocks) return [];
    if (filterKvartal === "all") return blocks;
    return blocks.filter(b => b.quarterId?.toString() === filterKvartal);
  }, [blocks, filterKvartal]);

  const uniqueFloors = useMemo(() => {
    if (!apartments) return [];
    return [...new Set(apartments.map((a: any) => a.floor))].sort((a, b) => a - b);
  }, [apartments]);

  const uniqueRooms = useMemo(() => {
    if (!apartments) return [];
    return [...new Set(apartments.map((a: any) => a.rooms))].sort((a, b) => a - b);
  }, [apartments]);

  const toggleFloor = (floor: number) => {
    setFilterFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor); else next.add(floor);
      return next;
    });
  };

  const hasActiveFilters = filterKvartal !== "all" || filterBlock !== "all" || filterFloors.size > 0 || filterRooms !== "all" || assetSearch.trim() !== "";

  const clearAllFilters = () => {
    setFilterKvartal("all");
    setFilterBlock("all");
    setFilterFloors(new Set());
    setFilterRooms("all");
    setAssetSearch("");
  };

  useEffect(() => {
    if (tariffs && watchAssetType && !watchPrice) {
      if (watchAssetType === 'apartment') setValue('pricePerSqm', tariffs.apartmentPricePerSqm.toString());
      if (watchAssetType === 'object') setValue('pricePerSqm', tariffs.objectPricePerSqm.toString());
      if (watchAssetType === 'garage') setValue('pricePerSqm', tariffs.garagePricePerSqm.toString());
    }
  }, [tariffs, watchAssetType, watchPrice, setValue]);

  const [calcResult, setCalcResult] = useState({ total: 0, monthly: 0 });

  useEffect(() => {
    let area = 0;
    if (watchAssetId) {
      if (watchAssetType === 'apartment') {
        area = apartments?.find((a: any) => a.id.toString() === watchAssetId)?.area || 0;
      } else {
        area = objects?.find((o: any) => o.id.toString() === watchAssetId)?.area || 0;
      }
    }
    const price = Number(watchPrice) || 0;
    const totalAmount = area * price;
    let monthly = 0;
    if (watchSaleType === 'credit') {
      const dp = Number(watchDownPayment) || 0;
      const months = Number(watchMonths) || 1;
      monthly = (totalAmount - dp) / months;
    }
    setCalcResult({ total: totalAmount, monthly: monthly > 0 ? monthly : 0 });
  }, [watchAssetType, watchAssetId, watchPrice, watchSaleType, watchDownPayment, watchMonths, apartments, objects]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const customer = await createCustomer({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          fin: data.fin || undefined,
          phone: data.phone,
          address: data.address || undefined,
        }
      });
      createSale({
        data: {
          customerId: customer.id,
          assetType: data.assetType,
          assetId: Number(data.assetId),
          saleType: data.saleType,
          pricePerSqm: Number(data.pricePerSqm),
          downPayment: data.saleType === 'credit' ? Number(data.downPayment) : 0,
          installmentMonths: data.saleType === 'credit' ? Number(data.installmentMonths) : undefined,
        }
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let all: any[] = [];
    if (watchAssetType === 'apartment') all = apartments || [];
    else if (watchAssetType === 'object') all = objects?.filter((o: any) => o.type === 'object') || [];
    else if (watchAssetType === 'garage') all = objects?.filter((o: any) => o.type === 'garage') || [];

    return all.filter((a: any) => {
      if (watchAssetType === 'apartment') {
        if (filterBlock !== 'all') {
          const block = blocks?.find(b => b.id.toString() === filterBlock);
          if (!block || a.blockName !== block.name) return false;
        } else if (filterKvartal !== 'all') {
          const block = blocks?.find(b => b.name === a.blockName);
          if (!block || block.quarterId?.toString() !== filterKvartal) return false;
        }
        if (filterFloors.size > 0 && !filterFloors.has(a.floor)) return false;
        if (filterRooms !== 'all' && a.rooms !== Number(filterRooms)) return false;
      }
      if (assetSearch.trim()) {
        const q = assetSearch.toLowerCase();
        const label = watchAssetType === 'apartment'
          ? `${a.blockName} ${a.number} ${a.floor} ${a.rooms}`.toLowerCase()
          : `${a.number}`.toLowerCase();
        if (!label.includes(q)) return false;
      }
      return true;
    });
  }, [watchAssetType, apartments, objects, blocks, assetSearch, filterKvartal, filterBlock, filterFloors, filterRooms]);

  const loading = isPending || isSubmitting;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/sales" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Yeni Satış</h1>
            <p className="text-muted-foreground mt-1">Müştəri məlumatları və aktiv satışı</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">

            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Müştəri Məlumatları
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ad <span className="text-destructive">*</span></label>
                    <Input {...register("firstName", { required: true })} placeholder="Əli"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.firstName ? "border-destructive" : ""}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Soyad <span className="text-destructive">*</span></label>
                    <Input {...register("lastName", { required: true })} placeholder="Əliyev"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.lastName ? "border-destructive" : ""}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefon <span className="text-destructive">*</span></label>
                    <Input {...register("phone", { required: true })} placeholder="+994 50 000 00 00"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.phone ? "border-destructive" : ""}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">FİN Kod</label>
                    <Input {...register("fin")} placeholder="1234ABC" className="rounded-xl h-12 bg-slate-50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ünvan</label>
                  <Input {...register("address")} placeholder="Naxçıvan, ..." className="rounded-xl h-12 bg-slate-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aktiv və Ödəniş</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Aktiv Növü</label>
                  <Controller
                    name="assetType"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={(val) => { field.onChange(val); setValue('assetId', ''); clearAllFilters(); }} value={field.value}>
                        <SelectTrigger className="rounded-xl h-12 bg-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CreateSaleInputAssetType.apartment}>Mənzil</SelectItem>
                          <SelectItem value={CreateSaleInputAssetType.object}>Obyekt</SelectItem>
                          <SelectItem value={CreateSaleInputAssetType.garage}>Qaraj</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <Controller
                  name="assetId"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">
                          Aktiv Seçin
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({filteredAssets.length} nəticə)
                          </span>
                        </label>
                        {hasActiveFilters && (
                          <button type="button" onClick={clearAllFilters}
                            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors">
                            <X className="w-3 h-3" /> Sıfırla
                          </button>
                        )}
                      </div>

                      {watchAssetType === 'apartment' && (
                        <div className="space-y-3 rounded-xl border border-border/60 bg-slate-50/50 p-3">
                          <div className="flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filterlər</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Kvartal</p>
                              <Select value={filterKvartal} onValueChange={(v) => { setFilterKvartal(v); setFilterBlock("all"); setValue('assetId', ''); }}>
                                <SelectTrigger className="h-8 rounded-lg text-xs bg-white border-border/60">
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
                              <p className="text-xs text-muted-foreground">Blok / Bina</p>
                              <Select value={filterBlock} onValueChange={(v) => { setFilterBlock(v); setValue('assetId', ''); }}>
                                <SelectTrigger className="h-8 rounded-lg text-xs bg-white border-border/60">
                                  <SelectValue placeholder="Hamısı" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Bütün Bloklar</SelectItem>
                                  {filteredBlockOptions.map(b => (
                                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {uniqueRooms.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Otaq sayı</p>
                              <div className="flex flex-wrap gap-1.5">
                                <FilterChip label="Hamısı" active={filterRooms === "all"} onClick={() => setFilterRooms("all")} />
                                {uniqueRooms.map((r: any) => (
                                  <FilterChip key={r} label={`${r} otaq`}
                                    active={filterRooms === r.toString()}
                                    onClick={() => setFilterRooms(filterRooms === r.toString() ? "all" : r.toString())} />
                                ))}
                              </div>
                            </div>
                          )}

                          {uniqueFloors.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Mərtəbə
                                {filterFloors.size > 0 && (
                                  <span className="ml-1.5 text-primary font-medium">({filterFloors.size} seçilib)</span>
                                )}
                                <span className="ml-1.5 text-muted-foreground/50 font-normal text-[10px]">çox seçim mümkündür</span>
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                                {uniqueFloors.map((f: any) => (
                                  <FilterChip key={f} label={`${f}-ci`}
                                    active={filterFloors.has(f)}
                                    onClick={() => toggleFloor(f)} />
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="relative pt-1 border-t border-border/40">
                            <Search className="absolute left-3 top-1/2 translate-y-0.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              value={assetSearch}
                              onChange={(e) => setAssetSearch(e.target.value)}
                              placeholder="Mənzil nömrəsi ilə axtarış..."
                              className="rounded-lg h-8 bg-white pl-8 text-xs border-border/60"
                            />
                          </div>
                        </div>
                      )}

                      {watchAssetType !== 'apartment' && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                            placeholder="Axtarış..." className="rounded-xl h-10 bg-slate-50 pl-9 text-sm"
                            disabled={!watchAssetType} />
                        </div>
                      )}

                      <div className="rounded-xl border border-border/60 bg-slate-50/50 overflow-y-auto max-h-56 p-2">
                        {!watchAssetType ? (
                          <p className="text-sm text-muted-foreground text-center py-6">Əvvəlcə aktiv növünü seçin</p>
                        ) : filteredAssets.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">Bu filterlərə uyğun boş aktiv tapılmadı</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {filteredAssets.map((a: any) => {
                              const isSelected = field.value === a.id.toString();
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => field.onChange(a.id.toString())}
                                  className={`text-left rounded-lg border-2 px-3 py-2.5 transition-all cursor-pointer hover:border-primary/50 hover:bg-white ${
                                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 bg-white"
                                  }`}
                                >
                                  {watchAssetType === 'apartment' ? (
                                    <>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-primary truncate">{a.blockName}</span>
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                                      </div>
                                      <p className="font-bold text-sm text-foreground">№ {a.number}</p>
                                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-0.5"><Layers className="w-3 h-3" />{a.floor}-ci mərtəbə</span>
                                        <span className="flex items-center gap-0.5"><SquareStack className="w-3 h-3" />{a.area} m²</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">{a.rooms} otaq</p>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-primary truncate">
                                          {watchAssetType === 'garage' ? 'Qaraj' : 'Obyekt'}
                                        </span>
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                                      </div>
                                      <p className="font-bold text-sm text-foreground">№ {a.number}</p>
                                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                        <Building2 className="w-3 h-3" />{a.area} m²
                                      </div>
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {errors.assetId && (
                        <p className="text-xs text-destructive">Aktiv seçmək mütləqdir</p>
                      )}
                    </div>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Satış Növü</label>
                    <Controller
                      name="saleType"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="rounded-xl h-12 bg-slate-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SaleType.cash}>Nağd</SelectItem>
                            <SelectItem value={SaleType.credit}>Kredit (Taksit)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">1 m² Qiyməti (AZN)</label>
                    <Input type="number" step="0.01" {...register("pricePerSqm", { required: true })} className="rounded-xl h-12 bg-slate-50" />
                  </div>
                </div>

                {watchSaleType === 'credit' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">İlkin Ödəniş (AZN)</label>
                      <Input type="number" {...register("downPayment", { required: true })} className="rounded-xl h-12 bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Müddət (Ay)</label>
                      <Input type="number" {...register("installmentMonths", { required: true })} className="rounded-xl h-12 bg-slate-50" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="md:col-span-1 space-y-6">
            <Card className="border-none shadow-lg shadow-primary/5 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Calculator className="w-32 h-32" />
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Kalkulyator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                <div>
                  <p className="text-sm text-muted-foreground">Ümumi Məbləğ</p>
                  <p className="text-3xl font-display font-bold text-foreground mt-1">{formatCurrency(calcResult.total)}</p>
                </div>
                {watchSaleType === 'credit' && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">İlkin Ödəniş</p>
                      <p className="text-xl font-semibold text-emerald-600 mt-1">{formatCurrency(Number(watchDownPayment) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Kredit Məbləği</p>
                      <p className="text-xl font-semibold text-foreground mt-1">{formatCurrency(calcResult.total - (Number(watchDownPayment) || 0))}</p>
                    </div>
                    <div className="pt-4 border-t border-border/50">
                      <p className="text-sm font-medium text-primary">Aylıq Ödəniş (Taksit)</p>
                      <p className="text-4xl font-display font-bold text-primary mt-2">{formatCurrency(calcResult.monthly)}</p>
                    </div>
                  </>
                )}
                <Button type="submit" disabled={loading || !watchAssetId} className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all mt-6">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Satışı Təsdiqlə"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
