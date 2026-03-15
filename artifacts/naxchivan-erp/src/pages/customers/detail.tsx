import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCustomer } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, ArrowLeft, User, Phone, MapPin, Hash } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data: customer, isLoading, isError } = useGetCustomer(Number(id));

  if (isLoading) {
    return <AppLayout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (isError || !customer) {
    return <AppLayout><div className="text-center text-destructive p-12">Müştəri tapılmadı</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Müştəri Profili</h1>
            <p className="text-muted-foreground mt-1">#{customer.id} - {customer.firstName} {customer.lastName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg shadow-black/5 md:col-span-1 h-fit">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center border-b border-border/50 pb-6 mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-primary/20">
                  {customer.firstName[0]}{customer.lastName[0]}
                </div>
                <h2 className="text-xl font-bold">{customer.firstName} {customer.lastName}</h2>
                <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {customer.phone}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">FIN Kod</p>
                    <p className="font-medium">{customer.fin || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ünvan</p>
                    <p className="font-medium">{customer.address || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-black/5 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Satınalma Tarixçəsi</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.sales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Bu müştərinin satınalması yoxdur.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarix</TableHead>
                      <TableHead>Aktiv</TableHead>
                      <TableHead>Növ</TableHead>
                      <TableHead>Məbləğ</TableHead>
                      <TableHead>Ödənilib</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-sm">{format(new Date(sale.saleDate), 'dd.MM.yyyy')}</TableCell>
                        <TableCell className="font-medium">{sale.assetDescription}</TableCell>
                        <TableCell><StatusBadge status={sale.saleType} /></TableCell>
                        <TableCell className="font-bold">{formatCurrency(sale.totalAmount)}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{formatCurrency(sale.paidAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
