import { AppLayout } from "@/components/layout/AppLayout";
import { useListSales } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Progress } from "@/components/ui/progress";

export default function SalesPage() {
  const { data: sales, isLoading } = useListSales();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Satışlar</h1>
            <p className="text-muted-foreground mt-1">Mənzil, obyekt və qaraj satışları</p>
          </div>
          
          <Link href="/sales/create" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 rounded-xl px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
            <Plus className="w-5 h-5 mr-2" /> Yeni Satış
          </Link>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tarix</TableHead>
                  <TableHead>Müştəri</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead>Növ</TableHead>
                  <TableHead className="text-right">Ümumi</TableHead>
                  <TableHead className="text-right">Ödənilib</TableHead>
                  <TableHead className="text-right">Qalıq Borc</TableHead>
                  <TableHead className="w-[120px]">İrəliləyiş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
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
                    </TableRow>
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
