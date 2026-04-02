import { useState, Fragment } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListRentals, useListObjects, RentalStatus, ObjectStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, User, Phone, FileText, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function RentalsPage() {
  const { data: rentals, isLoading, refetch } = useListRentals();
  const { data: objects } = useListObjects({ status: ObjectStatus.available });
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rentalPayments, setRentalPayments] = useState<Record<number, any[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  const { register, handleSubmit, control, reset, watch } = useForm({
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
    }
  });

  const watchedAssetId = watch("assetId");
  const watchedPricePerSqm = watch("pricePerSqm");
  const selectedObj = objects?.find((o: any) => o.id === Number(watchedAssetId));

  const calcMonthlyRent = () => {
    if (selectedObj && watchedPricePerSqm) {
      return (Number((selectedObj as any).area) * Number(watchedPricePerSqm)).toFixed(2);
    }
    return "";
  };

  const onSubmit = async (data: any) => {
    setIsPending(true);
    const monthly = data.monthlyAmount || calcMonthlyRent();
    const res = await fetch(`${BASE()}/api/rentals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: data.assetType,
        assetId: Number(data.assetId),
        contractNumber: data.contractNumber || null,
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantFin: data.tenantFin || null,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        pricePerSqm: data.pricePerSqm || null,
        monthlyAmount: Number(monthly),
      }),
    });
    setIsPending(false);
    if (res.ok) {
      setIsOpen(false);
      reset();
      refetch();
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Kirayələr</h1>
            <p className="text-muted-foreground mt-1">Obyekt və qarajların kirayə müqavilələri</p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Plus className="w-5 h-5 mr-2" /> Yeni Kirayə
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Yeni Kirayə Müqaviləsi</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                {/* Tenant info */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">İcarədar Məlumatları</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Adı Soyadı</label>
                    <Input {...register("tenantName", { required: true })} className="rounded-xl h-11" placeholder="Əli Həsənov" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mobil Nömrəsi</label>
                      <Input {...register("tenantPhone", { required: true })} className="rounded-xl h-11" placeholder="+994..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">FIN Kodu</label>
                      <Input {...register("tenantFin")} className="rounded-xl h-11" maxLength={7} placeholder="7 hərf" />
                    </div>
                  </div>
                </div>

                {/* Contract info */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Müqavilə Məlumatları</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Müqavilə Nömrəsi</label>
                    <Input {...register("contractNumber")} className="rounded-xl h-11" placeholder="Məs: MQ-2024-001" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Obyekt / Qaraj</label>
                    <Controller name="assetId" control={control} rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {objects?.map((o: any) => (
                              <SelectItem key={o.id} value={o.id.toString()}>
                                {o.type === "garage" ? "Qaraj" : "Obyekt"} {o.number}
                                {o.area ? ` — ${o.area} m²` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {selectedObj && (
                    <div className="text-xs bg-primary/10 text-primary rounded-lg px-3 py-2">
                      Sahə: {(selectedObj as any).area} m² · Tarifdən hesablanmış kira: {formatCurrency((selectedObj as any).monthlyRent)} / ay
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">m² Qiyməti (₼)</label>
                      <Input type="number" step="0.01" {...register("pricePerSqm")} className="rounded-xl h-11"
                        placeholder="Tarifdən istifadə et" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Aylıq Kira (₼)</label>
                      <Input type="number" step="0.01" {...register("monthlyAmount")} className="rounded-xl h-11"
                        placeholder={calcMonthlyRent() || "Avtomatik"} />
                    </div>
                  </div>
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

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>İcarədar</TableHead>
                  <TableHead>Müqavilə №</TableHead>
                  <TableHead>Obyekt</TableHead>
                  <TableHead>Müddət</TableHead>
                  <TableHead>Aylıq Kira</TableHead>
                  <TableHead>Ödənişlər</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  rentals?.map((rental: any) => (
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
                            {rental.tenantFin && (
                              <div className="text-xs text-muted-foreground font-mono">FIN: {rental.tenantFin}</div>
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
                        <TableCell className="font-medium">{rental.assetDescription}</TableCell>
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
                                    <button
                                      key={payment.id}
                                      onClick={() => togglePayment(rental.id, payment)}
                                      className={`rounded-xl p-3 text-left border transition-all ${
                                        isPaid
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                          : "bg-card border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 mb-1">
                                        {isPaid
                                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          : <Clock className="w-3.5 h-3.5" />}
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
