import { AppLayout } from "@/components/layout/AppLayout";
import { useListRentals, RentalStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function RentalsPage() {
  const { data: rentals, isLoading } = useListRentals();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Kirayələr</h1>
            <p className="text-muted-foreground mt-1">Obyekt və qarajların kirayə müqavilələri</p>
          </div>
          
          <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Plus className="w-5 h-5 mr-2" /> Yeni Kirayə
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
                  <TableHead>Obyekt/Qaraj</TableHead>
                  <TableHead>Başlama</TableHead>
                  <TableHead>Bitiş</TableHead>
                  <TableHead>Aylıq Məbləğ</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  rentals?.map((rental) => (
                    <TableRow key={rental.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">{rental.customerName}</TableCell>
                      <TableCell className="font-medium text-foreground">{rental.assetDescription}</TableCell>
                      <TableCell className="text-sm">{format(new Date(rental.startDate), 'dd.MM.yyyy')}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(rental.endDate), 'dd.MM.yyyy')}
                        {rental.status === 'active' && (
                           <div className={`text-xs mt-1 font-medium ${rental.daysRemaining < 30 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                             {rental.daysRemaining} gün qalıb
                           </div>
                        )}
                      </TableCell>
                      <TableCell className="font-bold">{formatCurrency(rental.monthlyAmount)}</TableCell>
                      <TableCell><StatusBadge status={rental.status} type="rental" /></TableCell>
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
