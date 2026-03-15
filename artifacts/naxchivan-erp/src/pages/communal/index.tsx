import { AppLayout } from "@/components/layout/AppLayout";
import { useListCommunalBills, usePayCommunalBill } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatArea } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { getListCommunalBillsQueryKey } from "@workspace/api-client-react";

export default function CommunalPage() {
  const { data: bills, isLoading } = useListCommunalBills();
  const queryClient = useQueryClient();
  const { mutate: payBill, isPending } = usePayCommunalBill({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCommunalBillsQueryKey() });
      }
    }
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Kommunal Xərclər</h1>
            <p className="text-muted-foreground mt-1">Aylıq kommunal ödənişlərin idarə edilməsi</p>
          </div>
          <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
             Hesablar Yarat
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Dövr</TableHead>
                  <TableHead>Mülkiyyətçi</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead>Sahə</TableHead>
                  <TableHead>Məbləğ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  bills?.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-foreground">{bill.month < 10 ? `0${bill.month}` : bill.month} / {bill.year}</TableCell>
                      <TableCell>{bill.ownerName}</TableCell>
                      <TableCell className="text-sm font-medium">{bill.assetDescription}</TableCell>
                      <TableCell className="text-muted-foreground">{formatArea(bill.area)}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(bill.amount)}</TableCell>
                      <TableCell><StatusBadge status={bill.status} type="payment" /></TableCell>
                      <TableCell className="text-right">
                        {bill.status !== 'paid' && (
                           <Button 
                             size="sm" 
                             className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                             onClick={() => payBill({ id: bill.id })}
                             disabled={isPending}
                           >
                             <CheckCircle2 className="w-4 h-4 mr-1.5" /> Ödə
                           </Button>
                        )}
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
