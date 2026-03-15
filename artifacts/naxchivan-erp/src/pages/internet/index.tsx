import { AppLayout } from "@/components/layout/AppLayout";
import { useListInternetSubscriptions, usePayInternetBill } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { getListInternetSubscriptionsQueryKey } from "@workspace/api-client-react";

export default function InternetPage() {
  const { data: subs, isLoading } = useListInternetSubscriptions();
  const queryClient = useQueryClient();
  const { mutate: renew, isPending } = usePayInternetBill({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInternetSubscriptionsQueryKey() })
    }
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">İnternet Abunələri</h1>
            <p className="text-muted-foreground mt-1">Sakinlərin internet paketlərinin idarəsi</p>
          </div>
          <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Plus className="w-5 h-5 mr-2" /> Yeni Abunə
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Müştəri</TableHead>
                  <TableHead>Mənzil/Obyekt</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Bitiş Tarixi</TableHead>
                  <TableHead>Aylıq Məbləğ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  subs?.map((sub) => (
                    <TableRow key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">{sub.ownerName}</TableCell>
                      <TableCell className="text-sm font-medium text-muted-foreground">{sub.assetDescription}</TableCell>
                      <TableCell>
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-xs font-bold">{sub.packageName}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(sub.expiryDate), 'dd.MM.yyyy')}
                        {sub.status === 'active' && (
                           <div className={`text-xs mt-1 font-medium ${sub.daysRemaining < 7 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                             {sub.daysRemaining} gün qalıb
                           </div>
                        )}
                      </TableCell>
                      <TableCell className="font-bold">{formatCurrency(sub.monthlyPrice)}</TableCell>
                      <TableCell><StatusBadge status={sub.status} type="internet" /></TableCell>
                      <TableCell className="text-right">
                         <Button 
                           size="sm" 
                           variant="outline"
                           className="rounded-lg hover:bg-primary hover:text-primary-foreground border-primary/20 text-primary"
                           onClick={() => renew({ id: sub.id })}
                           disabled={isPending}
                         >
                           <RefreshCw className="w-4 h-4 mr-1.5" /> Yenilə
                         </Button>
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
