import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  useListApartments, 
  useListObjects, 
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
import { Loader2, ArrowLeft, Calculator, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";

export default function CreateSalePage() {
  const [, setLocation] = useLocation();
  const { data: apartments } = useListApartments({ status: ApartmentStatus.available });
  const { data: objects } = useListObjects({ status: ObjectStatus.available });
  const { data: tariffs } = useListTariffs();

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
        area = apartments?.find(a => a.id.toString() === watchAssetId)?.area || 0;
      } else {
        area = objects?.find(o => o.id.toString() === watchAssetId)?.area || 0;
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

    setCalcResult({
      total: totalAmount,
      monthly: monthly > 0 ? monthly : 0
    });
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

  const getAvailableAssets = () => {
    if (watchAssetType === 'apartment') return apartments || [];
    if (watchAssetType === 'object') return objects?.filter(o => o.type === 'object') || [];
    if (watchAssetType === 'garage') return objects?.filter(o => o.type === 'garage') || [];
    return [];
  };

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
                    <Input
                      {...register("firstName", { required: true })}
                      placeholder="Əli"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.firstName ? "border-destructive" : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Soyad <span className="text-destructive">*</span></label>
                    <Input
                      {...register("lastName", { required: true })}
                      placeholder="Əliyev"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.lastName ? "border-destructive" : ""}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefon <span className="text-destructive">*</span></label>
                    <Input
                      {...register("phone", { required: true })}
                      placeholder="+994 50 000 00 00"
                      className={`rounded-xl h-12 bg-slate-50 ${errors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">FİN Kod</label>
                    <Input
                      {...register("fin")}
                      placeholder="1234ABC"
                      className="rounded-xl h-12 bg-slate-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ünvan</label>
                  <Input
                    {...register("address")}
                    placeholder="Naxçıvan, ..."
                    className="rounded-xl h-12 bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aktiv və Ödəniş</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aktiv Növü</label>
                    <Controller
                      name="assetType"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={(val) => { field.onChange(val); setValue('assetId', ''); }} value={field.value}>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aktiv Seçin (Yalnız boşlar)</label>
                    <Controller
                      name="assetId"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchAssetType}>
                          <SelectTrigger className="rounded-xl h-12 bg-slate-50">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableAssets().map((a: any) => (
                              <SelectItem key={a.id} value={a.id.toString()}>
                                {watchAssetType === 'apartment' ? `${a.blockName} - Mənzil ${a.number} (${a.area}m²)` : `${a.number} (${a.area}m²)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

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
