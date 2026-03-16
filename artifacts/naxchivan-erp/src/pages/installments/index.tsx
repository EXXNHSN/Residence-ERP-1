import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListInstallments, usePayInstallment, PaymentStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { getListInstallmentsQueryKey } from "@workspace/api-client-react";

export default function InstallmentsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [payDialog, setPayDialog] = useState<{isOpen: boolean, installmentId: number | null}>({ isOpen: false, installmentId: null });

  const { data: installments, isLoading } = useListInstallments({
    status: filterStatus !== "all" ? filterStatus as PaymentStatus : undefined
  });

  const queryClient = useQueryClient();
  const { mutate: pay, isPending } = usePayInstallment({
    mutation: {
      onSuccess: () => {
        setPayDialog({ isOpen: false, installmentId: null });
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
      }
    }
  });

  const handlePay = () => {
    if (payDialog.installmentId) {
      pay({
        id: payDialog.installmentId,
        data: { paidDate: new Date().toISOString() }
      });
    }
  };

  const grouped = installments?.reduce((acc, inst) => {
    const key = `${inst.saleId}-${inst.customerName}`;
    if (!acc[key]) {
      acc[key] = { saleId: inst.saleId, customerName: inst.customerName, items: [] };
    }
    acc[key].items.push(inst);
    return acc;
  }, {} as Record<string, { saleId: number; customerName: string; items: typeof installments }>) ?? {};

  const groups = Object.values(grouped);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Ödənişlər (Taksitlər)</h1>
            <p className="text-muted-foreground mt-1">Aylıq kredit ödənişlərinin cədvəli</p>
          </div>
          
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

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 p-12 text-center text-muted-foreground">
            Məlumat tapılmadı
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={`${group.saleId}-${group.customerName}`} className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-muted/40 border-b border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{group.customerName}</p>
                    <p className="text-xs text-muted-foreground">Satış #{group.saleId} · {group.items.length} aylıq ödəniş</p>
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16">Ay</TableHead>
                      <TableHead>Ödəniş Tarixi</TableHead>
                      <TableHead>Məbləğ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Əməliyyat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((inst) => (
                      <TableRow key={inst.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs font-bold">
                            {inst.installmentNumber}. Ay
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {format(new Date(inst.dueDate), 'dd.MM.yyyy')}
                          {inst.paidDate && (
                            <div className="text-xs text-emerald-600 mt-0.5">
                              Ödənilib: {format(new Date(inst.paidDate), 'dd.MM.yyyy')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-foreground">{formatCurrency(inst.amount)}</TableCell>
                        <TableCell><StatusBadge status={inst.status} type="payment" /></TableCell>
                        <TableCell className="text-right">
                          {inst.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                              onClick={() => setPayDialog({ isOpen: true, installmentId: inst.id })}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Ödəniş et
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}

        <Dialog open={payDialog.isOpen} onOpenChange={(open) => !open && setPayDialog({ isOpen: false, installmentId: null })}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Ödənişi təsdiqlə</DialogTitle>
              <DialogDescription className="text-base mt-2">
                Bu aylıq ödənişi (Taksit #{payDialog.installmentId}) ödənildi olaraq qeyd etmək istədiyinizə əminsiniz?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-3">
              <Button variant="outline" onClick={() => setPayDialog({ isOpen: false, installmentId: null })} className="rounded-xl h-11">Ləğv et</Button>
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
