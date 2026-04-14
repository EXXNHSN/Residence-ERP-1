import { useState, Fragment } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListInstallments, PaymentStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, AlertCircle, Download, Banknote, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { getListInstallmentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

type InstallmentItem = {
  id: number;
  saleId: number;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  customerName: string;
  assetDescription: string;
  monthlyPayment: number;
};

function PartialBadge() {
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-medium">
      Qismən ödənilib
    </Badge>
  );
}

export default function InstallmentsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedSales, setExpandedSales] = useState<Set<number>>(new Set());
  const [payDialog, setPayDialog] = useState<{
    isOpen: boolean;
    saleId: number | null;
    customerName?: string;
    monthlyPayment?: number;
    totalRemaining?: number;
  }>({ isOpen: false, saleId: null });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isBulkPaying, setIsBulkPaying] = useState(false);

  const { data: installments, isLoading } = useListInstallments({
    status: filterStatus !== "all" ? filterStatus as PaymentStatus : undefined
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleExpand = (saleId: number) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      next.has(saleId) ? next.delete(saleId) : next.add(saleId);
      return next;
    });
  };

  // Group by saleId
  const grouped = (installments ?? []).reduce((acc, inst: any) => {
    if (!acc[inst.saleId]) {
      acc[inst.saleId] = {
        saleId: inst.saleId,
        customerName: inst.customerName,
        assetDescription: inst.assetDescription,
        monthlyPayment: inst.monthlyPayment,
        items: [],
      };
    }
    acc[inst.saleId].items.push(inst);
    return acc;
  }, {} as Record<number, {
    saleId: number;
    customerName: string;
    assetDescription: string;
    monthlyPayment: number;
    items: InstallmentItem[];
  }>);

  const groups = Object.values(grouped);
  const overdueCount = (installments ?? []).filter((i: any) => i.status === "overdue").length;

  function openPayDialog(group: typeof groups[0]) {
    const totalRemaining = group.items
      .filter(i => i.status !== "paid")
      .reduce((s, i) => s + i.remainingAmount, 0);
    setPayDialog({
      isOpen: true,
      saleId: group.saleId,
      customerName: group.customerName,
      monthlyPayment: group.monthlyPayment,
      totalRemaining,
    });
    setPaymentAmount(String(group.monthlyPayment));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
  }

  async function handleBulkPay() {
    if (!payDialog.saleId || !paymentAmount || Number(paymentAmount) <= 0) return;
    setIsBulkPaying(true);
    try {
      const res = await fetch(`${BASE()}/api/installments/bulk-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: payDialog.saleId,
          paymentAmount: Number(paymentAmount),
          paymentDate: new Date(paymentDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Xəta baş verdi");
      }
      const result = await res.json();
      toast({
        title: "Ödəniş qeydə alındı",
        description: `${formatCurrency(result.appliedAmount)} tətbiq edildi. ${result.updatedCount} ödəniş yeniləndi.${result.remainingBalance > 0 ? ` Üstəgəl qalıq: ${formatCurrency(result.remainingBalance)}` : ""}`,
      });
      setPayDialog({ isOpen: false, saleId: null });
      queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (err: any) {
      toast({ title: "Xəta", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkPaying(false);
    }
  }

  // Excel export for a single sale group
  function exportGroupToExcel(group: typeof groups[0]) {
    const rows = group.items.map(inst => ({
      "№": inst.installmentNumber,
      "Son ödəniş tarixi": format(new Date(inst.dueDate), "dd.MM.yyyy"),
      "Aylıq məbləğ (AZN)": inst.amount,
      "Ödənilmiş (AZN)": inst.paidAmount,
      "Qalıq (AZN)": inst.remainingAmount,
      "Ödəniş tarixi": inst.paidDate ? format(new Date(inst.paidDate), "dd.MM.yyyy") : "",
      "Status": inst.status === "paid" ? "Ödənilib" :
                inst.status === "partial" ? "Qismən ödənilib" :
                inst.status === "overdue" ? "Gecikib" : "Gözləyir",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 4 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ödəniş Cədvəli");

    // Summary sheet
    const total = group.items.reduce((s, i) => s + i.amount, 0);
    const paid = group.items.reduce((s, i) => s + i.paidAmount, 0);
    const remaining = group.items.reduce((s, i) => s + i.remainingAmount, 0);
    const summary = [
      { "Məlumat": "Sakin", "Dəyər": group.customerName },
      { "Məlumat": "Mənzil / Aktiv", "Dəyər": group.assetDescription },
      { "Məlumat": "Aylıq ödəniş", "Dəyər": `${group.monthlyPayment} AZN` },
      { "Məlumat": "Ümumi məbləğ", "Dəyər": `${total.toFixed(2)} AZN` },
      { "Məlumat": "Cəmi ödənilib", "Dəyər": `${paid.toFixed(2)} AZN` },
      { "Məlumat": "Qalıq borc", "Dəyər": `${remaining.toFixed(2)} AZN` },
      { "Məlumat": "Export tarixi", "Dəyər": format(new Date(), "dd.MM.yyyy HH:mm") },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    ws2["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Xülasə");

    XLSX.writeFile(wb, `odenis-cedveli-${group.customerName.replace(/\s+/g, "-")}.xlsx`);
  }

  // Excel export for all installments
  function exportAllToExcel() {
    const rows = (installments ?? []).map((inst: any) => ({
      "Sakin": inst.customerName,
      "Mənzil": inst.assetDescription,
      "№": inst.installmentNumber,
      "Son ödəniş tarixi": format(new Date(inst.dueDate), "dd.MM.yyyy"),
      "Aylıq məbləğ (AZN)": inst.amount,
      "Ödənilmiş (AZN)": inst.paidAmount ?? 0,
      "Qalıq (AZN)": inst.remainingAmount ?? inst.amount,
      "Ödəniş tarixi": inst.paidDate ? format(new Date(inst.paidDate), "dd.MM.yyyy") : "",
      "Status": inst.status === "paid" ? "Ödənilib" :
                inst.status === "partial" ? "Qismən ödənilib" :
                inst.status === "overdue" ? "Gecikib" : "Gözləyir",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 20 }, { wch: 20 }, { wch: 4 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bütün Ödənişlər");
    XLSX.writeFile(wb, `butun-odenisler-${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Ödənişlər (Taksitlər)</h1>
            <p className="text-muted-foreground mt-1">Aylıq kredit ödənişlərinin cədvəli</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {overdueCount > 0 && filterStatus !== "overdue" && (
              <button
                onClick={() => setFilterStatus("overdue")}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                {overdueCount} gecikmiş
              </button>
            )}
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={exportAllToExcel}>
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] rounded-xl bg-card shadow-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Ödənişlər</SelectItem>
                <SelectItem value={PaymentStatus.pending}>Gözləyir</SelectItem>
                <SelectItem value={PaymentStatus.paid}>Ödənilib</SelectItem>
                <SelectItem value={PaymentStatus.overdue}>Gecikib</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Məlumat tapılmadı</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Sakin</TableHead>
                  <TableHead>Mənzil</TableHead>
                  <TableHead>Aylıq</TableHead>
                  <TableHead>Növbəti Tarix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const nextInst = group.items.find(i => i.status === "overdue") ??
                                   group.items.find(i => i.status === "partial") ??
                                   group.items.find(i => i.status === "pending");
                  const isExpanded = expandedSales.has(group.saleId);
                  const hasOverdue = group.items.some(i => i.status === "overdue");
                  const hasPartial = group.items.some(i => i.status === "partial");
                  const totalPaid = group.items.reduce((s, i) => s + i.paidAmount, 0);
                  const totalAmount = group.items.reduce((s, i) => s + i.amount, 0);
                  const progressPct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

                  return (
                    <Fragment key={group.saleId}>
                      {/* Summary row */}
                      <TableRow
                        className={`cursor-pointer transition-colors ${
                          hasOverdue ? "bg-red-50/60 hover:bg-red-50" :
                          hasPartial ? "bg-amber-50/40 hover:bg-amber-50/60" :
                          "hover:bg-muted/30"
                        }`}
                        onClick={() => toggleExpand(group.saleId)}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center text-muted-foreground">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {hasOverdue && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                              <span className="font-semibold text-foreground">{group.customerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={progressPct} className="h-1.5 w-20" />
                              <span className="text-xs text-muted-foreground">{progressPct}%</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{group.assetDescription}</TableCell>
                        <TableCell className="font-bold text-primary">{formatCurrency(group.monthlyPayment)}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {nextInst ? (
                            <span className={nextInst.status === "overdue" ? "text-red-600 font-semibold" : ""}>
                              {format(new Date(nextInst.dueDate), "dd.MM.yyyy")}
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-xs font-medium">Tamamlandı</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {nextInst ? (
                            nextInst.status === "partial" ? <PartialBadge /> :
                            <StatusBadge status={nextInst.status} type="payment" />
                          ) : (
                            <StatusBadge status="paid" type="payment" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-8 text-xs gap-1.5"
                              onClick={(e) => { e.stopPropagation(); exportGroupToExcel(group); }}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Excel
                            </Button>
                            {nextInst && nextInst.status !== "paid" && (
                              <Button
                                size="sm"
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-1.5"
                                onClick={(e) => { e.stopPropagation(); openPayDialog(group); }}
                              >
                                <Banknote className="w-4 h-4" />
                                Ödəniş et
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail rows */}
                      {isExpanded && group.items.map((inst) => (
                        <TableRow
                          key={`detail-${inst.id}`}
                          className={`text-sm border-l-4 ${
                            inst.status === "overdue" ? "border-l-red-400 bg-red-50/40" :
                            inst.status === "paid" ? "border-l-emerald-400 bg-emerald-50/20" :
                            inst.status === "partial" ? "border-l-amber-400 bg-amber-50/30" :
                            "border-l-slate-200 bg-muted/10"
                          }`}
                        >
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs font-bold ml-6">
                              {inst.installmentNumber}. Ay
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground">{formatCurrency(inst.amount)}</p>
                              {inst.paidAmount > 0 && inst.paidAmount < inst.amount && (
                                <p className="text-xs text-amber-600">
                                  Ödənilib: {formatCurrency(inst.paidAmount)} · Qalıq: {formatCurrency(inst.remainingAmount)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm">{format(new Date(inst.dueDate), "dd.MM.yyyy")}</p>
                              {inst.paidDate && (
                                <p className="text-xs text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {format(new Date(inst.paidDate), "dd.MM.yyyy")}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {inst.status === "partial" ? <PartialBadge /> :
                             <StatusBadge status={inst.status} type="payment" />}
                          </TableCell>
                          <TableCell className="text-right">
                            {inst.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg h-7 text-xs"
                                onClick={() => openPayDialog(group)}
                              >
                                <Banknote className="w-3 h-3 mr-1" />
                                Ödə
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Bulk payment dialog */}
        <Dialog open={payDialog.isOpen} onOpenChange={(open) => !open && setPayDialog({ isOpen: false, saleId: null })}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                Ödəniş qeydə al
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                <strong>{payDialog.customerName}</strong> — ödəniş məbləğini daxil edin. Sistem avtomatik olaraq taksit cədvəlinə tətbiq edəcək.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Payment amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ödəniş məbləği (AZN)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="Məbləği daxil edin"
                  className="rounded-xl h-12 text-lg font-bold"
                />
                {payDialog.monthlyPayment && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(payDialog.monthlyPayment))}
                      className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                    >
                      1 ay: {formatCurrency(payDialog.monthlyPayment!)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(Math.round(payDialog.monthlyPayment! * 2 * 100) / 100))}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                    >
                      2 ay: {formatCurrency(payDialog.monthlyPayment! * 2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(Math.round(payDialog.monthlyPayment! * 3 * 100) / 100))}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                    >
                      3 ay: {formatCurrency(payDialog.monthlyPayment! * 3)}
                    </button>
                    {payDialog.totalRemaining && payDialog.totalRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(String(Math.round(payDialog.totalRemaining! * 100) / 100))}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium hover:bg-emerald-100 transition-colors"
                      >
                        Tam borc: {formatCurrency(payDialog.totalRemaining!)}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Payment date */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  Ödəniş tarixi
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              {/* Preview: how many months will be covered */}
              {paymentAmount && Number(paymentAmount) > 0 && payDialog.monthlyPayment && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-sm">
                  <p className="text-emerald-800 font-medium">
                    Təxmini: {Math.floor(Number(paymentAmount) / payDialog.monthlyPayment!)} tam ay ödənəcək
                    {Number(paymentAmount) % payDialog.monthlyPayment! > 0 && (
                      <span className="text-emerald-600">
                        {" "}+ {formatCurrency(Number(paymentAmount) % payDialog.monthlyPayment!)} növbəti aya tətbiq ediləcək
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 gap-3">
              <Button variant="outline" onClick={() => setPayDialog({ isOpen: false, saleId: null })} className="rounded-xl h-11">
                Ləğv et
              </Button>
              <Button
                onClick={handleBulkPay}
                disabled={isBulkPaying || !paymentAmount || Number(paymentAmount) <= 0}
                className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 px-8 shadow-lg shadow-emerald-600/20"
              >
                {isBulkPaying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ödənişi təsdiqlə"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
