import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  useListApartments, 
  useListObjects,
  useListBlocks,
  useCreateSale,
  useCreateCustomer,
  useListCustomers,
  useListSales,
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
import { Loader2, ArrowLeft, Calculator, User, CheckCircle2, Building2, X, SlidersHorizontal, Zap, FileText, Receipt, Calendar, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { IdCardInput, type IdCardType } from "@/components/IdCardInput";

function toRoman(num: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const todayStr = new Date().toISOString().split("T")[0];

  const { data: apartments } = useListApartments({ status: ApartmentStatus.available });
  const { data: objects } = useListObjects({ status: ObjectStatus.available });
  const { data: tariffs } = useListTariffs();
  const { data: blocks } = useListBlocks();
  const { data: customers = [] } = useListCustomers();
  const { data: sales = [] } = useListSales();

  const [saleIdCardType, setSaleIdCardType] = useState<IdCardType>("");
  const [saleIdCardNumber, setSaleIdCardNumber] = useState("");
  const [idCardError, setIdCardError] = useState("");

  // Mövcud sakin (FİN yazıldıqda avtomatik tapılan)
  const [existingCustomer, setExistingCustomer] = useState<any | null>(null);

  const { mutateAsync: createCustomer } = useCreateCustomer();
  const { mutateAsync: createSale, isPending } = useCreateSale();

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
      installmentMonths: "12",
      saleDate: todayStr,
      initialPaidAmount: "",
      contractNumber: "",
      qaimeNumber: ""
    }
  });

  const watchAssetType = watch("assetType");
  const watchAssetId = watch("assetId");
  const watchSaleType = watch("saleType");
  const watchPrice = watch("pricePerSqm");
  const watchDownPayment = watch("downPayment");
  const watchMonths = watch("installmentMonths");
  const watchFin = watch("fin");
  const watchContractNumber = watch("contractNumber");
  const watchQaimeNumber = watch("qaimeNumber");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterKvartal, setFilterKvartal] = useState("all");
  const [filterBlock, setFilterBlock] = useState("all");
  const [filterFloors, setFilterFloors] = useState<Set<number>>(new Set());
  const [filterRooms, setFilterRooms] = useState("all");
  const [floorPriceTiers, setFloorPriceTiers] = useState<{ id: number; floorFrom: number; floorTo: number; pricePerSqm: number }[]>([]);
  // Qeyri-yaşayış üçün xüsusi sahə (m²) — istifadəçi dəyişdirə bilər
  const [customObjectArea, setCustomObjectArea] = useState("");

  const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetch(`${BASE()}/api/floor-price-tiers`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setFloorPriceTiers(data))
      .catch(() => {});
  }, []);

  // Müqavilə nömrəsinin canlı təkrarolunmazlıq yoxlanışı
  const isContractDuplicate = useMemo(() => {
    if (!watchContractNumber?.trim()) return false;
    const clean = watchContractNumber.trim().toLowerCase();
    return sales.some((s: any) => s.contractNumber && s.contractNumber.trim().toLowerCase() === clean);
  }, [watchContractNumber, sales]);

  // Qaimə nömrəsinin canlı təkrarolunmazlıq yoxlanışı
  const isQaimeDuplicate = useMemo(() => {
    if (!watchQaimeNumber?.trim()) return false;
    const clean = watchQaimeNumber.trim().toLowerCase();
    return sales.some((s: any) => s.qaimeNumber && s.qaimeNumber.trim().toLowerCase() === clean);
  }, [watchQaimeNumber, sales]);

  // FİN yazıldıqda avtomatik sakini axtar və formu doldur
  const handleFinChange = (finVal: string) => {
    setValue("fin", finVal);
    const cleanFin = finVal.trim().toUpperCase();
    if (cleanFin.length === 7) {
      const match = customers.find(c => c.fin && c.fin.toUpperCase() === cleanFin);
      if (match) {
        setExistingCustomer(match);
        setValue("firstName", match.firstName || "");
        setValue("lastName", match.lastName || "");
        setValue("phone", match.phone || "");
        setValue("address", match.address || "");
        if (match.idCardType) setSaleIdCardType(match.idCardType as IdCardType);
        if (match.idCardNumber) setSaleIdCardNumber(match.idCardNumber);
        setIdCardError("");
        toast({
          title: "Sakin Tapıldı",
          description: `${match.firstName} ${match.lastName} məlumatları bazadan gətirildi.`,
        });
      } else {
        setExistingCustomer(null);
      }
    } else {
      if (existingCustomer) setExistingCustomer(null);
    }
  };

  const clearExistingCustomer = () => {
    setExistingCustomer(null);
    setValue("firstName", "");
    setValue("lastName", "");
    setValue("fin", "");
    setValue("phone", "");
    setValue("address", "");
    setSaleIdCardType("");
    setSaleIdCardNumber("");
  };

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
    if (filterBlock !== "all" && blocks) {
      const blk = blocks.find(b => b.id.toString() === filterBlock);
      if (blk && blk.floors) {
        return Array.from({ length: blk.floors }, (_, i) => i + 1);
      }
    }
    if (!apartments) return [];
    return [...new Set(apartments.map((a: any) => a.floor))].sort((a: number, b: number) => a - b);
  }, [apartments, filterBlock, blocks]);

  const uniqueRooms = useMemo(() => {
    if (!apartments) return [];
    return [...new Set(apartments.map((a: any) => a.rooms))].sort((a: number, b: number) => a - b);
  }, [apartments]);

  const toggleFloor = (floor: number) => {
    setFilterFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor); else next.add(floor);
      return next;
    });
  };

  const hasActiveFilters = filterKvartal !== "all" || filterBlock !== "all" || filterFloors.size > 0 || filterRooms !== "all";

  const clearAllFilters = () => {
    setFilterKvartal("all");
    setFilterBlock("all");
    setFilterFloors(new Set());
    setFilterRooms("all");
  };

  useEffect(() => {
    if (!tariffs || !watchAssetType) return;
    if (watchAssetType === 'garage') {
      setValue('pricePerSqm', ((tariffs as any).garageSalePrice ?? 5000).toString());
      return;
    }
    if (watchAssetType !== 'apartment') {
      if (watchAssetType === 'object') setValue('pricePerSqm', tariffs.objectPricePerSqm.toString());
      return;
    }
    if (!watchAssetId) {
      setValue('pricePerSqm', tariffs.apartmentPricePerSqm.toString());
      return;
    }
    const apt = apartments?.find((a: any) => a.id.toString() === watchAssetId);
    if (!apt) return;
    const floor = (apt as any).floor as number;
    const tier = floorPriceTiers.find(t => floor >= t.floorFrom && floor <= t.floorTo);
    setValue('pricePerSqm', tier ? tier.pricePerSqm.toString() : tariffs.apartmentPricePerSqm.toString());
  }, [tariffs, watchAssetType, watchAssetId, apartments, floorPriceTiers]);

  const [calcResult, setCalcResult] = useState({ total: 0, monthly: 0 });

  useEffect(() => {
    let totalAmount = 0;
    if (watchAssetType === 'garage') {
      totalAmount = Number(watchPrice) || 0;
    } else {
      let area = 0;
      if (watchAssetId) {
        if (watchAssetType === 'apartment') {
          area = apartments?.find((a: any) => a.id.toString() === watchAssetId)?.area || 0;
        } else {
          // For objects, use custom area if set, otherwise fall back to stored area
          const storedArea = objects?.find((o: any) => o.id.toString() === watchAssetId)?.area || 0;
          area = customObjectArea ? Number(customObjectArea) : storedArea;
        }
      }
      const price = Number(watchPrice) || 0;
      totalAmount = area * price;
    }
    let monthly = 0;
    if (watchSaleType === 'credit') {
      const dp = Number(watchDownPayment) || 0;
      const months = Number(watchMonths) || 1;
      monthly = (totalAmount - dp) / months;
    }
    setCalcResult({ total: totalAmount, monthly: monthly > 0 ? monthly : 0 });
  }, [watchAssetType, watchAssetId, watchPrice, watchSaleType, watchDownPayment, watchMonths, apartments, objects, customObjectArea]);

  const onSubmit = async (data: any) => {
    if (isContractDuplicate) {
      toast({ title: "Xəta", description: "Bu müqavilə nömrəsi artıq istifadə olunub!", variant: "destructive" });
      return;
    }
    if (isQaimeDuplicate) {
      toast({ title: "Xəta", description: "Bu qaimə nömrəsi artıq istifadə olunub!", variant: "destructive" });
      return;
    }

    if (!saleIdCardType) {
      setIdCardError("Şəxsiyyət vəsiqəsinin növü mütləqdir");
      return;
    }
    if (!saleIdCardNumber.trim()) {
      setIdCardError("Şəxsiyyət vəsiqəsinin nömrəsi mütləqdir");
      return;
    }
    setIdCardError("");
    setIsSubmitting(true);

    try {
      let customerId = existingCustomer?.id;

      if (!customerId) {
        const customer = await createCustomer({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            fin: data.fin || undefined,
            phone: data.phone,
            address: data.address || undefined,
            idCardType: saleIdCardType || undefined,
            idCardNumber: saleIdCardNumber?.trim() || undefined,
          } as any
        });
        customerId = customer.id;
      }

      const isGarage = data.assetType === 'garage';
      const isObject = data.assetType === 'object';
      const effectiveSaleDate = !isAdmin ? todayStr : (data.saleDate || todayStr);

      await createSale({
        data: {
          customerId,
          assetType: data.assetType,
          assetId: Number(data.assetId),
          saleType: data.saleType,
          pricePerSqm: isGarage ? 0 : Number(data.pricePerSqm),
          downPayment: data.saleType === 'credit' ? Number(data.downPayment) : 0,
          installmentMonths: data.saleType === 'credit' ? Number(data.installmentMonths) : undefined,
          contractNumber: data.contractNumber?.trim(),
          qaimeNumber: data.qaimeNumber?.trim(),
          saleDate: new Date(effectiveSaleDate).toISOString(),
          initialPaidAmount: isAdmin && data.saleType === 'credit' && data.initialPaidAmount ? Number(data.initialPaidAmount) : 0,
          ...(isGarage ? { totalAmountOverride: calcResult.total } : {}),
          // Qeyri-yaşayış üçün xüsusi sahə
          ...(isObject && customObjectArea ? { customArea: Number(customObjectArea) } : {}),
        } as any
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/apartments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/objects"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/stats/summary"] }),
      ]);

      toast({ 
        title: "Satış uğurla qeydə alındı", 
        description: `Müqavilə № ${data.contractNumber} — ${data.firstName} ${data.lastName} üçün tərtib edildi.` 
      });
      setLocation("/sales");
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = (err?.data as any)?.error ?? err?.message ?? "Bilinməyən xəta baş verdi";
      toast({ title: "Satış yaradılmadı", description: msg, variant: "destructive" });
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
      return true;
    });
  }, [watchAssetType, apartments, objects, blocks, filterKvartal, filterBlock, filterFloors, filterRooms]);

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
            <p className="text-muted-foreground mt-1">Sakin məlumatları və aktiv satışı</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">

            {/* Müştəri Məlumatları */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Müştəri Məlumatları
                </CardTitle>
                {existingCustomer && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearExistingCustomer} className="text-xs text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5 mr-1" /> Təmizlə (Yeni Müştəri)
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">

                {/* Status banner əgər FİN ilə mövcud sakin tapılıbsa */}
                {existingCustomer && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Qeydiyyatda olan sakin:</strong> {existingCustomer.firstName} {existingCustomer.lastName} (FİN: {existingCustomer.fin}). Məlumatlar bazadan gətirildi.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Ad <span className="text-destructive">*</span></label>
                    <Input {...register("firstName", { required: "Tələb olunur" })} placeholder="Əli"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.firstName ? "border-destructive" : ""}`} />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message as string}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Soyad <span className="text-destructive">*</span></label>
                    <Input {...register("lastName", { required: "Tələb olunur" })} placeholder="Əliyev"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.lastName ? "border-destructive" : ""}`} />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message as string}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Telefon <span className="text-destructive">*</span></label>
                    <Input {...register("phone", { required: "Tələb olunur" })} placeholder="+994 50 000 00 00"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.phone ? "border-destructive" : ""}`} />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone.message as string}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>FİN Kod <span className="text-destructive">*</span></span>
                      <span className="text-[10px] text-muted-foreground font-normal">7 simvol (avtomatik axtarış)</span>
                    </label>
                    <Input 
                      value={watchFin}
                      onChange={(e) => handleFinChange(e.target.value)}
                      placeholder="1234ABC"
                      maxLength={7}
                      className={`rounded-xl h-12 bg-slate-50 uppercase ${errors.fin ? "border-destructive" : ""}`} 
                    />
                    {errors.fin && <p className="text-xs text-destructive">{errors.fin.message as string}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Ünvan <span className="text-destructive">*</span></label>
                  <Input {...register("address", { required: "Tələb olunur" })} placeholder="Naxçıvan, ..."
                    className={`rounded-xl h-12 bg-slate-50 ${errors.address ? "border-destructive" : ""}`} />
                  {errors.address && <p className="text-xs text-destructive">{errors.address.message as string}</p>}
                </div>

                <div className="border-t border-border/50 pt-3">
                  <IdCardInput
                    idCardType={saleIdCardType}
                    idCardNumber={saleIdCardNumber}
                    onTypeChange={t => { setSaleIdCardType(t); if (t) setIdCardError(""); }}
                    onNumberChange={n => { setSaleIdCardNumber(n); if (n.trim()) setIdCardError(""); }}
                    error={idCardError}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Aktiv və Satış Şərtləri */}
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
                          <SelectItem value={CreateSaleInputAssetType.garage}>Avto Dayanacaq</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Qrafik / Kart Görünüşü ilə Aktiv Seçimi */}
                <Controller
                  name="assetId"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          Mövcud {watchAssetType === 'apartment' ? 'Mənzillər' : watchAssetType === 'object' ? 'Qeyri-yaşayış Obyektləri' : 'Avto Dayanacaqlar'}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({filteredAssets.length} aktiv mövcuddur)
                          </span>
                        </label>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 text-xs text-destructive hover:underline"
                          >
                            <X className="w-3 h-3" /> Filterləri sıfırla
                          </button>
                        )}
                      </div>

                      {/* Filter idarəetməsi */}
                      {watchAssetType === 'apartment' && (
                        <div className="space-y-2.5 rounded-2xl border border-border/60 bg-slate-50/70 p-3.5">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">Kvartal</p>
                              <Select value={filterKvartal} onValueChange={(v) => { setFilterKvartal(v); setFilterBlock("all"); setFilterFloors(new Set()); setValue('assetId', ''); }}>
                                <SelectTrigger className="h-9 rounded-xl text-xs bg-white border-border/60">
                                  <SelectValue placeholder="Bütün Kvartallar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Bütün Kvartallar</SelectItem>
                                  {uniqueKvartals.map(q => (
                                    <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">Blok / Bina</p>
                              <Select value={filterBlock} onValueChange={(v) => { setFilterBlock(v); setFilterFloors(new Set()); setValue('assetId', ''); }}>
                                <SelectTrigger className="h-9 rounded-xl text-xs bg-white border-border/60">
                                  <SelectValue placeholder="Bütün Bloklar" />
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
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">Otaq sayı</p>
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
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                                Mərtəbə
                                {filterFloors.size > 0 && (
                                  <span className="ml-1 text-primary font-bold">({filterFloors.size})</span>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                <FilterChip key="all-fl" label="Hamısı" active={filterFloors.size === 0} onClick={() => setFilterFloors(new Set())} />
                                {uniqueFloors.map((f: any) => (
                                  <FilterChip key={f} label={toRoman(f)}
                                    active={filterFloors.has(f)}
                                    onClick={() => toggleFloor(f)} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Görkəmli Kart Görünüşü (Grid) */}
                      {filteredAssets.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
                          Seçilmiş filterlərə uyğun aktiv tapılmadı
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-2 bg-slate-50/50 rounded-2xl border border-border/60">
                          {filteredAssets.map((asset: any) => {
                            const isSelected = field.value === asset.id.toString();
                            return (
                              <div
                                key={asset.id}
                                onClick={() => field.onChange(asset.id.toString())}
                                className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 relative ${
                                  isSelected
                                    ? "bg-primary text-white border-primary shadow-md ring-2 ring-primary/40 -translate-y-0.5"
                                    : "bg-white hover:border-primary/60 hover:shadow-sm border-border/70"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`font-bold text-base ${isSelected ? "text-white" : "text-foreground"}`}>
                                    {watchAssetType === 'apartment' ? `Mənzil № ${asset.number}` : watchAssetType === 'object' ? `Obyekt № ${asset.number}` : `Qaraj № ${asset.number}`}
                                  </span>
                                  {isSelected ? (
                                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Boş
                                    </span>
                                  )}
                                </div>

                                <p className={`text-xs mt-1 truncate ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                                  {asset.blockName ? `${asset.blockName} • ` : ""}{asset.floor ? `${toRoman(asset.floor)} mərtəbə` : ""}
                                </p>

                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30 text-xs">
                                  <span className={isSelected ? "text-white/90" : "text-foreground font-medium"}>
                                    {asset.rooms ? `${asset.rooms} otaq` : watchAssetType}
                                  </span>
                                  <span className={`font-bold ${isSelected ? "text-white" : "text-primary"}`}>
                                    {asset.area > 0 ? `${asset.area} m²` : "Qaraj"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Seçilmiş aktivin qabarıq göstərilməsi */}
                      {field.value && (
                        <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-primary font-medium">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                            <span>
                              <strong>Seçilmiş Aktiv:</strong> {
                                (() => {
                                  const sel = filteredAssets.find((a: any) => a.id.toString() === field.value);
                                  if (!sel) return `#${field.value}`;
                                  return watchAssetType === 'apartment'
                                    ? `${sel.blockName} — Mənzil ${sel.number} (${sel.floor}-ci mərtəbə, ${sel.rooms} otaq, ${sel.area} m²)`
                                    : `${sel.number} (${sel.area} m²)`;
                                })()
                              }
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => field.onChange("")}
                            className="text-xs text-muted-foreground hover:text-destructive underline"
                          >
                            Dəyiş
                          </button>
                        </div>
                      )}

                      {/* Qeyri-yaşayış üçün xüsusi sahə daxiletmə */}
                      {watchAssetType === 'object' && field.value && (
                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                            <p className="text-xs font-semibold text-amber-900">Qeyri-yaşayış Sahəsi Tənzimlənməsi</p>
                          </div>
                          <p className="text-[11px] text-amber-800 mb-2">
                            Qeyri-yaşayış sahələri standart deyil — ölçüsünü sahibkarla razılaşdırıb aşağıda daxil edin.
                            Boş saxlasanız obyektin qeydiyyatdakı sahəsi istifadə olunacaq.
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              placeholder={`Default: ${filteredAssets.find((a: any) => a.id.toString() === field.value)?.area || 0} m²`}
                              value={customObjectArea}
                              onChange={(e) => setCustomObjectArea(e.target.value)}
                              className="rounded-xl h-10 bg-white border-amber-300 text-sm flex-1"
                            />
                            <span className="text-sm font-medium text-amber-800 shrink-0">m²</span>
                            {customObjectArea && (
                              <button
                                type="button"
                                onClick={() => setCustomObjectArea("")}
                                className="text-xs text-amber-700 hover:text-destructive underline shrink-0"
                              >
                                Sıfırla
                              </button>
                            )}
                          </div>
                          {customObjectArea && Number(customObjectArea) > 0 && (
                            <p className="text-[11px] text-amber-700 font-medium">
                              Satış hesabı: <strong>{customObjectArea} m²</strong> × qiymət = yekun məbləğ
                            </p>
                          )}
                        </div>
                      )}

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
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      {watchAssetType === 'garage' ? (
                        <span className="flex items-center gap-1.5">Sabit Qiymət (AZN)
                          <span className="text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> sabit
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">1 m² Qiyməti (AZN)
                          {watchAssetId && watchAssetType === 'apartment' && (
                            <span className="text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> avtomatik
                            </span>
                          )}
                        </span>
                      )}
                    </label>
                    <Input type="number" step="0.01" {...register("pricePerSqm", { required: true })}
                      className="rounded-xl h-12 bg-slate-50"
                      placeholder={watchAssetType === 'garage' ? 'Tarifdən avtomatik' : 'El ilə daxil edə bilərsiniz'}
                      readOnly={watchAssetType === 'garage'} />
                  </div>
                </div>

                {/* Müqavilə və Qaimə Nömrələri (MƏCBURİ VƏ CANLI UNİKALLIQ YOXLANIŞI) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      Müqavilə Nömrəsi <span className="text-destructive">*</span>
                    </label>
                    <Input 
                      {...register("contractNumber", { required: "Müqavilə nömrəsi mütləqdir" })} 
                      placeholder="Məs: M-2024-001" 
                      className={`rounded-xl h-12 bg-slate-50 ${errors.contractNumber || isContractDuplicate ? "border-destructive ring-1 ring-destructive" : ""}`} 
                    />
                    {isContractDuplicate && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Bu müqavilə nömrəsi artıq verilib!
                      </p>
                    )}
                    {errors.contractNumber && !isContractDuplicate && (
                      <p className="text-xs text-destructive">{errors.contractNumber.message as string}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      Qaimə Nömrəsi <span className="text-destructive">*</span>
                    </label>
                    <Input 
                      {...register("qaimeNumber", { required: "Qaimə nömrəsi mütləqdir" })} 
                      placeholder="Məs: Q-2024-001" 
                      className={`rounded-xl h-12 bg-slate-50 ${errors.qaimeNumber || isQaimeDuplicate ? "border-destructive ring-1 ring-destructive" : ""}`} 
                    />
                    {isQaimeDuplicate && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Bu qaimə nömrəsi artıq verilib!
                      </p>
                    )}
                    {errors.qaimeNumber && !isQaimeDuplicate && (
                      <p className="text-xs text-destructive">{errors.qaimeNumber.message as string}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Müqavilə Tarixi <span className="text-destructive">*</span>
                    </label>
                    <Input 
                      type="date" 
                      {...register("saleDate", { required: "Tarix mütləqdir" })} 
                      min={!isAdmin ? todayStr : undefined}
                      readOnly={!isAdmin}
                      className={`rounded-xl h-12 ${!isAdmin ? "bg-muted cursor-not-allowed opacity-90" : "bg-slate-50"}`} 
                    />
                    {!isAdmin && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Satıcı üçün yalnız cari gün tətbiq olunur</p>
                    )}
                  </div>
                </div>

                {/* Kredit Sahələri */}
                {watchSaleType === 'credit' && (
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">İlkin Ödəniş (AZN)</label>
                        <Input type="number" {...register("downPayment", { required: true })} className="rounded-xl h-12 bg-slate-50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Müddət (Ay)</label>
                        <Input type="number" {...register("installmentMonths", { required: true })} className="rounded-xl h-12 bg-slate-50" />
                      </div>
                    </div>

                    {/* YALNIZ ADMINISTRATOR ÜÇÜN KÖHNƏ MÜQAVİLƏLƏRDƏ ÖDƏNİLMİŞ MƏBLƏĞ */}
                    {isAdmin && (
                      <div className="space-y-2 rounded-xl bg-blue-50/60 border border-blue-200/60 p-4">
                        <label className="text-sm font-semibold text-blue-950 flex items-center justify-between">
                          <span>İndiyə qədər ödənilmiş cəmi məbləğ (Köhnə müqavilələr üçün)</span>
                          <span className="text-xs text-blue-600 font-normal">Yalnız Admin</span>
                        </label>
                        <Input
                          type="number"
                          {...register("initialPaidAmount")}
                          placeholder="Məs: 18000"
                          className="rounded-xl h-11 bg-white border-blue-200"
                        />
                        <p className="text-xs text-blue-800/80">
                          Əgər keçmiş tarixli satış daxil edirsinizsə, sakinin bu günə qədər ödədiyi cəmi məbləği qeyd edin. Sistem həmin məbləği keçmiş ayların üzərinə ardıcıl paylayacaq və sakin sistemdə borclu/gecikmədə çıxmayacaq.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Kalkulyator & Xülasə */}
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

                {/* ƏDV section — apartments and objects */}
                {(watchAssetType === 'apartment' || watchAssetType === 'object') && calcResult.total > 0 && (
                  <div className="pt-4 border-t border-border/50 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-semibold text-amber-700">ƏDV Məlumatı</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Şirkət ƏDV (18%)</span>
                        <span className="font-bold text-amber-700">{formatCurrency(calcResult.total * 0.18)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">Satış dəyərinin 18%-i şirkətin ƏDV hesabına köçürülür.</p>
                    </div>
                    {watchSaleType === 'cash' && (
                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Müştəriyə ƏDV qaytarma (30%×18%)</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(calcResult.total * 0.18 * 0.30)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">Nağd ödənişdə dövlət tərəfindən müştəriyə ƏDV-nin 30%-i geri qaytarılır.</p>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading || !watchAssetId || isContractDuplicate || isQaimeDuplicate} 
                  className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all mt-6"
                >
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
