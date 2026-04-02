import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListSales } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Pencil, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SalesPage() {
  const { data: sales, isLoading } = useListSales();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDown, setEditDown] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editDate, setEditDate] = useState("");

  function openEdit(sale: any) {
    setEditingSale(sale);
    setEditPrice(sale.pricePerSqm?.toString() ?? "");
    setEditDown(sale.downPayment?.toString() ?? "0");
    setEditMonths(sale.installmentMonths?.toString() ?? "12");
    setEditDate(format(new Date(sale.saleDate), "yyyy-MM-dd"));
    setEditOpen(true);
  }

  async function handleSaveSale(adminPassword: string) {
    const body: any = {
      username: user?.username,
      password: adminPassword,
      pricePerSqm: Number(editPrice),
      saleDate: editDate,
    };
    if (editingSale?.saleType === "credit") {
      body.downPayment = Number(editDown);
      body.installmentMonths = Number(editMonths);
    }
    const res = await fetch(`${BASE()}/api/sales/${editingSale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: "Satış məlumatları yeniləndi" });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Satışlar</h1>
            <p className="text-muted-foreground mt-1">Mənzil, qeyri yaşayış və avto dayanacaq satışları</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/sales/credits" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-10 rounded-xl px-4 border border-border/60 bg-white hover:bg-muted transition-colors text-foreground shadow-sm">
              <CreditCard className="w-4 h-4 mr-2 text-blue-600" /> Kredit Hesabat
            </Link>
            <Link href="/sales/create" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-10 rounded-xl px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
              <Plus className="w-5 h-5 mr-2" /> Yeni Satış
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tarix</TableHead>
                  <TableHead>Sakin</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead>Növ</TableHead>
                  <TableHead className="text-right">Ümumi</TableHead>
                  <TableHead className="text-right">Ödənilib</TableHead>
                  <TableHead className="text-right">Qalıq Borc</TableHead>
                  <TableHead className="w-[120px]">İrəliləyiş</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  sales?.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(sale.saleDate), 'dd.MM.yyyy')}</TableCell>
                      <TableCell className="font-semibold">
                        <Link href={`/customers/${sale.customerId}`} className="hover:text-primary transition-colors">
                          {sale.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{sale.assetDescription}</TableCell>
                      <TableCell><StatusBadge status={sale.saleType} /></TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-emerald-600">{formatCurrency(sale.paidAmount)}</span>
                        {sale.saleType === 'credit' && sale.downPayment > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            İlkin: {formatCurrency(sale.downPayment)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${sale.remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatCurrency(sale.remainingAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{Math.round(sale.progressPercent)}%</span>
                          </div>
                          <Progress value={sale.progressPercent} className="h-2 bg-slate-100" />
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(sale)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Satışı Redaktə et" onSave={handleSaveSale}>
        {editingSale && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
              {editingSale.customerName} — {editingSale.assetDescription}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">1 m² Qiyməti (AZN)</label>
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tarix</label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
            </div>
            {editingSale.saleType === "credit" && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">İlkin Ödəniş (AZN)</label>
                  <Input type="number" value={editDown} onChange={(e) => setEditDown(e.target.value)}
                    className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Müddət (Ay)</label>
                  <Input type="number" value={editMonths} onChange={(e) => setEditMonths(e.target.value)}
                    className="rounded-xl h-11" />
                </div>
              </div>
            )}
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
