import { useState, Fragment } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListInstallments, usePayInstallment, PaymentStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { getListInstallmentsQueryKey } from "@workspace/api-client-react";

export default function InstallmentsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedSales, setExpandedSales] = useState<Set<number>>(new Set());
  const [payDialog, setPayDialog] = useState<{ isOpen: boolean; installmentId: number | null; customerName?: string }>({
    isOpen: false,
    installmentId: null,
  });

  const { data: installments, isLoading } = useListInstallments({
    status: filterStatus !== "all" ? filterStatus as PaymentStatus : undefined
  });

  const queryClient = useQueryClient();
  const { mutate: pay, isPending } = usePayInstallment({
    mutation: {
      onSuccess: () => {
        setPayDialog({ isOpen: false, installmentId: null });
        // Refresh installments, sales, and customers so paidAmount updates everywhere
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    }
  });

  const handlePay = () => {
    if (payDialog.installmentId) {
      pay({ id: payDialog.installmentId, data: { paidDate: new Date().toISOString() } });
    }
  };

  const toggleExpand = (saleId: number) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      next.has(saleId) ? next.delete(saleId) : next.add(saleId);
      return next;
    });
  };

  // Group by saleId
  const grouped = (installments ?? []).reduce((acc, inst) => {
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
    items: NonNullable<typeof installments>;
  }>);

  const groups = Object.values(grouped);

  const overdueCount = (installments ?? []).filter(i => i.status === "overdue").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Ödənişlər (Taksitlər)</h1>
            <p className="text-muted-foreground mt-1">Aylıq kredit ödənişlərinin cədvəli</p>
          </div>
          <div className="flex items-center gap-3">
            {overdueCount > 0 && filterStatus !== "overdue" && (
              <button
                onClick={() => setFilterStatus("overdue")}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                {overdueCount} gecikmiş ödəniş
              </button>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px] rounded-xl bg-card shadow-sm">
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
                  <TableHead>Aylıq Ödəniş</TableHead>
                  <TableHead>Növbəti Tarix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const nextInst = group.items.find(i => i.status === "overdue") ?? group.items.find(i => i.status === "pending");
                  const isExpanded = expandedSales.has(group.saleId);
                  const hasOverdue = group.items.some(i => i.status === "overdue");

                  return (
                    <Fragment key={group.saleId}>
                      {/* Summary row */}
                      <TableRow
                        key={`summary-${group.saleId}`}
                        className={`cursor-pointer transition-colors ${hasOverdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-muted/30"}`}
                        onClick={() => toggleExpand(group.saleId)}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center text-muted-foreground">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasOverdue && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                            <span className="font-semibold text-foreground">{group.customerName}</span>
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
                            <StatusBadge status={nextInst.status} type="payment" />
                          ) : (
                            <StatusBadge status="paid" type="payment" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {nextInst && nextInst.status !== "paid" && (
                            <Button
                              size="sm"
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayDialog({ isOpen: true, installmentId: nextInst.id, customerName: group.customerName });
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              Ödəniş et
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail rows */}
                      {isExpanded && group.items.map((inst) => (
                        <TableRow
                          key={`detail-${inst.id}`}
                          className={`text-sm border-l-4 ${
                            inst.status === "overdue" ? "border-l-red-400 bg-red-50/40" :
                            inst.status === "paid" ? "border-l-emerald-400 bg-emerald-50/20" :
                            "border-l-slate-200 bg-muted/10"
                          }`}
                        >
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs font-bold ml-6">
                              {inst.installmentNumber}. Ay
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(inst.amount)}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(inst.dueDate), "dd.MM.yyyy")}
                            {inst.paidDate && (
                              <div className="text-xs text-emerald-600 mt-0.5">
                                Ödənilib: {format(new Date(inst.paidDate), "dd.MM.yyyy")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={inst.status} type="payment" />
                          </TableCell>
                          <TableCell className="text-right">
                            {inst.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg h-7 text-xs"
                                onClick={() => setPayDialog({ isOpen: true, installmentId: inst.id, customerName: group.customerName })}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
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

        <Dialog open={payDialog.isOpen} onOpenChange={(open) => !open && setPayDialog({ isOpen: false, installmentId: null })}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Ödənişi təsdiqlə</DialogTitle>
              <DialogDescription className="text-base mt-2">
                {payDialog.customerName && <strong>{payDialog.customerName}</strong>} üçün ödənişi (#{payDialog.installmentId}) ödənildi olaraq qeyd etmək istədiyinizə əminsiniz?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-3">
              <Button variant="outline" onClick={() => setPayDialog({ isOpen: false, installmentId: null })} className="rounded-xl h-11">
                Ləğv et
              </Button>
              <Button onClick={handlePay} disabled={isPending} className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 px-8 shadow-lg shadow-emerald-600/20">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Təsdiqlə"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
