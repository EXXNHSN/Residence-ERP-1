import { useState, Fragment, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListRentals, useListObjects, useListCustomers, RentalStatus, ObjectStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, User, Phone, FileText, ChevronDown, ChevronUp, CheckCircle2, Clock, Car, Store, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function RentalsPage() {
  const { data: rentals, isLoading, refetch } = useListRentals();
  const { data: objects } = useListObjects({ status: ObjectStatus.available });
  const { data: customers } = useListCustomers();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rentalPayments, setRentalPayments] = useState<Record<number, any[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<number, boolean>>({});
  const [filterType, setFilterType] = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const { register, handleSubmit, control, reset, watch, setValue } = useForm({
    defaultValues: {
      assetType: "object",
      assetId: "",
      contractNumber: "",
      tenantName: "",
      tenantPhone: "",
      tenantFin: "",
      startDate: "",
      endDate: "",
      pricePerSqm: "",
      monthlyAmount: "",
      customerId: "",
    }
  });

  const watchedAssetId = watch("assetId");
  const watchedPricePerSqm = watch("pricePerSqm");
  const watchedCustomerId = watch("customerId");
  const selectedObj = objects?.find((o: any) => o.id === Number(watchedAssetId));
  const isGarageRental = selectedObj?.type === "garage";

  // When garage is selected, auto-fill monthly amount from garage tariff
  useEffect(() => {
    if (isGarageRental && selectedObj) {
      setValue("monthlyAmount", String((selectedObj as any).monthlyRent ?? 100));
    }
  }, [watchedAssetId, isGarageRental, selectedObj, setValue]);

  // When a customer is selected for garage rental, pre-fill their name/phone
  useEffect(() => {
    if (watchedCustomerId && customers) {
      const cust = customers.find((c: any) => c.id.toString() === watchedCustomerId);
      if (cust) {
        setValue("tenantName", `${cust.firstName} ${cust.lastName}`);
        setValue("tenantPhone", cust.phone || "");
        setValue("tenantFin", cust.fin || "");
      }
    }
  }, [watchedCustomerId, customers, setValue]);

  const calcMonthlyRent = () => {
    if (selectedObj && watchedPricePerSqm && !isGarageRental) {
      return (Number((selectedObj as any).area) * Number(watchedPricePerSqm)).toFixed(2);
    }
    return "";
  };

  const filteredCustomers = customers?.filter((c: any) => {
    const q = customerSearch.toLowerCase();
    return `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q);
  });

  const onSubmit = async (data: any) => {
    setIsPending(true);
    const monthly = isGarageRental ? data.monthlyAmount : (data.monthlyAmount || calcMonthlyRent());
    const res = await fetch(`${BASE()}/api/rentals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: selectedObj?.type ?? data.assetType,
        assetId: Number(data.assetId),
        customerId: data.customerId ? Number(data.customerId) : null,
        contractNumber: data.contractNumber || null,
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantFin: data.tenantFin || null,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        pricePerSqm: isGarageRental ? null : (data.pricePerSqm || null),
        monthlyAmount: Number(monthly),
      }),
    });
    setIsPending(false);
    if (res.ok) {
      setIsOpen(false);
      reset();
      setCustomerSearch("");
      setShowCustomerSearch(false);
      refetch();
      toast({ title: "Uğurlu", description: isGarageRental ? "Qaraj icarəsi yaradıldı. Kommunal faktura yarandığında qaraj icarəsi ayrıca göstəriləcək." : "İcarə müqaviləsi yaradıldı." });
    } else {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      toast({ title: "Xəta", description: err.error, variant: "destructive" });
    }
  };

  async function loadPayments(rentalId: number) {
    if (rentalPayments[rentalId]) {
      setExpandedId(expandedId === rentalId ? null : rentalId);
      return;
    }
    setLoadingPayments(p => ({ ...p, [rentalId]: true }));
    const res = await fetch(`${BASE()}/api/object-payments/rental/${rentalId}`);
    const data = await res.json();
    setRentalPayments(p => ({ ...p, [rentalId]: data }));
    setLoadingPayments(p => ({ ...p, [rentalId]: false }));
    setExpandedId(rentalId);
  }

  async function togglePayment(rentalId: number, payment: any) {
    const isPaid = payment.status === "paid";
    const endpoint = isPaid ? "unpay" : "pay";
    const res = await fetch(`${BASE()}/api/object-payments/${payment.id}/${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate: new Date().toISOString().split("T")[0] }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRentalPayments(prev => ({
        ...prev,
        [rentalId]: prev[rentalId].map(p => p.id === updated.id ? updated : p),
      }));
    }
  }

  const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

  const filteredRentals = rentals?.filter((r: any) => {
    if (filterType === "all") return true;
    if (filterType === "garage") return r.assetType === "garage" || r.assetDescription?.toLowerCase().includes("qaraj");
    if (filterType === "object") return r.assetType === "object" && !r.assetDescription?.toLowerCase().includes("qaraj");
    return true;
  });

  const garageRentals = rentals?.filter((r: any) => r.assetType === "garage") ?? [];
  const objectRentals = rentals?.filter((r: any) => r.assetType === "object") ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">İcarələr</h1>
            <p className="text-muted-foreground mt-1">Obyekt və qarajların icarə müqavilələri</p>
          </div>
          <Dialog open={isOpen} onOpenChange={v => { setIsOpen(v); if (!v) { reset(); setCustomerSearch(""); setShowCustomerSearch(false); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Plus className="w-5 h-5 mr-2" /> Yeni İcarə
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Yeni İcarə Müqaviləsi</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                {/* Asset selection */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">İcarə Obyekti</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Obyekt / Qaraj</label>
                    <Controller name="assetId" control={control} rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={v => { field.onChange(v); }} value={field.value}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {objects?.filter((o: any) => o.type === "object").length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">── Ticarət Obyektləri</div>
                                {objects?.filter((o: any) => o.type === "object").map((o: any) => (
                                  <SelectItem key={o.id} value={o.id.toString()}>
                                    <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-amber-500" /> Obyekt {o.number} {o.area ? `— ${o.area} m²` : ""}</span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            {objects?.filter((o: any) => o.type === "garage").length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">── Qarajlar / Dayanacaq</div>
                                {objects?.filter((o: any) => o.type === "garage").map((o: any) => (
                                  <SelectItem key={o.id} value={o.id.toString()}>
                                    <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-indigo-500" /> Qaraj {o.number} {o.blockName ? `(${o.blockName})` : ""}</span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {selectedObj && (
                    <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${isGarageRental ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-primary/10 text-primary"}`}>
                      {isGarageRental ? (
                        <><Car className="w-3.5 h-3.5" /> Qaraj sabit aylıq icarə: <strong>{formatCurrency((selectedObj as any).monthlyRent ?? 100)}</strong></>
                      ) : (
                        <>Sahə: {(selectedObj as any).area} m² · Tarifdən hesablanmış: {formatCurrency((selectedObj as any).monthlyRent)} / ay</>
                      )}
                    </div>
                  )}

                  {isGarageRental && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 border border-amber-200">
                      Qaraj icarəsi kommunal fakturada <strong>ayrıca sətir</strong> kimi göstəriləcək.
                    </div>
                  )}
                </div>

                {/* Customer link for garage */}
                {isGarageRental && (
                  <div className="bg-indigo-50/50 rounded-xl border border-indigo-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-indigo-800">Mövcud Müştəriyə Bağla</p>
                      <button type="button" onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                        className="text-xs text-indigo-600 hover:underline">
                        {showCustomerSearch ? "Ləğv et" : "Müştəri seç"}
                      </button>
                    </div>
                    {showCustomerSearch && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                            placeholder="Müştəri adı ilə axtarış..." className="rounded-xl h-9 pl-8 text-sm" />
                        </div>
                        <Controller name="customerId" control={control} render={({ field }) => (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {filteredCustomers?.map((c: any) => (
                              <button key={c.id} type="button"
                                onClick={() => field.onChange(field.value === c.id.toString() ? "" : c.id.toString())}
                                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all border ${field.value === c.id.toString() ? "bg-indigo-100 border-indigo-400 text-indigo-800" : "bg-white border-border/60 hover:border-indigo-300"}`}>
                                <span className="font-medium">{c.firstName} {c.lastName}</span>
                                {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
                                {field.value === c.id.toString() && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 float-right mt-0.5" />}
                              </button>
                            ))}
                          </div>
                        )} />
                      </>
                    )}
                    {watchedCustomerId && (
                      <div className="text-xs text-indigo-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Seçilmiş: {customers?.find((c: any) => c.id.toString() === watchedCustomerId)?.firstName}{" "}
                        {customers?.find((c: any) => c.id.toString() === watchedCustomerId)?.lastName}
                        <button type="button" onClick={() => { setValue("customerId", ""); setShowCustomerSearch(false); }} className="ml-1 text-indigo-500 hover:text-indigo-700">×</button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Bağlandıqda qaraj icarəsi müştərinin kommunal hesabına avtomatik əlavə ediləcək.</p>
                  </div>
                )}

                {/* Tenant info */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">İcarədar Məlumatları</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Adı Soyadı</label>
                    <Input {...register("tenantName", { required: true })} className="rounded-xl h-11" placeholder="Əli Həsənov" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mobil</label>
                      <Input {...register("tenantPhone", { required: true })} className="rounded-xl h-11" placeholder="+994..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">FIN</label>
                      <Input {...register("tenantFin")} className="rounded-xl h-11" maxLength={7} placeholder="7 hərf" />
                    </div>
                  </div>
                </div>

                {/* Contract details */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Müqavilə Məlumatları</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Müqavilə Nömrəsi</label>
                    <Input {...register("contractNumber")} className="rounded-xl h-11" placeholder="Məs: MQ-2024-001" />
                  </div>

                  {!isGarageRental && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">m² Qiyməti (₼)</label>
                        <Input type="number" step="0.01" {...register("pricePerSqm")} className="rounded-xl h-11"
                          placeholder="Tarifdən" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Aylıq Kira (₼)</label>
                        <Input type="number" step="0.01" {...register("monthlyAmount")} className="rounded-xl h-11"
                          placeholder={calcMonthlyRent() || "Avtomatik"} />
                      </div>
                    </div>
                  )}

                  {isGarageRental && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Aylıq İcarə (₼)</label>
                      <Input type="number" step="0.01" {...register("monthlyAmount")} className="rounded-xl h-11" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Başlama Tarixi</label>
                      <Input type="date" {...register("startDate", { required: true })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bitmə Tarixi</label>
                      <Input type="date" {...register("endDate", { required: true })} className="rounded-xl h-11" />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-md">
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Müqavilə Yarat"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary stats */}
        {rentals && rentals.length > 0 && (
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              <span className="text-muted-foreground">Ticarət obyektləri:</span>
              <strong>{objectRentals.length}</strong>
              <span className="text-muted-foreground text-xs">({formatCurrency(objectRentals.reduce((s: number, r: any) => s + Number(r.monthlyAmount), 0))} / ay)</span>
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-2">
              <Car className="w-4 h-4 text-indigo-500" />
              <span className="text-muted-foreground">Qarajlar:</span>
              <strong>{garageRentals.length}</strong>
              <span className="text-muted-foreground text-xs">({formatCurrency(garageRentals.reduce((s: number, r: any) => s + Number(r.monthlyAmount), 0))} / ay)</span>
            </span>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px] rounded-xl bg-card"><SelectValue placeholder="Tip" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün İcarələr</SelectItem>
              <SelectItem value="object">Ticarət Obyektləri</SelectItem>
              <SelectItem value="garage">Qarajlar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>İcarədar</TableHead>
                  <TableHead>Müqavilə №</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead>Müddət</TableHead>
                  <TableHead>Aylıq Kira</TableHead>
                  <TableHead>Ödənişlər</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : filteredRentals?.map((rental: any) => (
                  <Fragment key={rental.id}>
                    <TableRow className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {rental.tenantName || rental.customerName || "—"}
                          </div>
                          {rental.tenantPhone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {rental.tenantPhone}
                            </div>
                          )}
                          {rental.customerId && (
                            <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Müştəri bağlı
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rental.contractNumber ? (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" /> {rental.contractNumber}
                          </div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          {rental.assetType === "garage"
                            ? <Car className="w-3.5 h-3.5 text-indigo-500" />
                            : <Store className="w-3.5 h-3.5 text-amber-500" />}
                          {rental.assetDescription}
                        </div>
                        {rental.assetType === "garage" && (
                          <Badge className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200 mt-0.5" variant="outline">Qaraj</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{format(new Date(rental.startDate), 'dd.MM.yyyy')}</div>
                        <div className="text-muted-foreground">— {format(new Date(rental.endDate), 'dd.MM.yyyy')}</div>
                        {rental.status === "active" && (
                          <div className={`text-xs font-medium mt-0.5 ${rental.daysRemaining < 30 ? "text-rose-500" : "text-muted-foreground"}`}>
                            {rental.daysRemaining} gün qalıb
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-primary">{formatCurrency(rental.monthlyAmount)}</TableCell>
                      <TableCell>
                        {rental.totalPayments > 0 ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {rental.paidCount}
                            </span>
                            <span className="text-muted-foreground">/ {rental.totalPayments}</span>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={rental.status} type="rental" /></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => loadPayments(rental.id)}>
                          {loadingPayments[rental.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                            expandedId === rental.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="ml-1">Ödənişlər</span>
                        </Button>
                      </TableCell>
                    </TableRow>

                    {expandedId === rental.id && rentalPayments[rental.id] && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/20 px-6 py-4">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-muted-foreground mb-3">Aylıq Ödənişlər — {rental.assetDescription}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {rentalPayments[rental.id].map((payment: any) => {
                                const [yr, mo] = payment.period.split("-");
                                const monthName = MONTHS_AZ[Number(mo) - 1];
                                const isPaid = payment.status === "paid";
                                return (
                                  <button key={payment.id} onClick={() => togglePayment(rental.id, payment)}
                                    className={`rounded-xl p-3 text-left border transition-all ${isPaid
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                      : "bg-card border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"}`}>
                                    <div className="flex items-center gap-1 mb-1">
                                      {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
                                      <span className="text-xs font-semibold">{monthName} {yr}</span>
                                    </div>
                                    <div className="text-xs font-bold">{formatCurrency(Number(payment.amount))}</div>
                                    {isPaid && payment.paymentDate && (
                                      <div className="text-xs opacity-70 mt-0.5">{format(new Date(payment.paymentDate), 'dd.MM.yy')}</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
