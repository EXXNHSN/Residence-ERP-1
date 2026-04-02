import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCustomer } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Phone, MapPin, Hash, Pencil, CreditCard, Key } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCustomerQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function RentalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Aktiv", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ended: { label: "Bitib", className: "bg-slate-100 text-slate-600 border-slate-200" },
    cancelled: { label: "Ləğv edilib", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <Badge variant="outline" className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.className}`}>
      {s.label}
    </Badge>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data: customer, isLoading, isError } = useGetCustomer(Number(id));
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editFin, setEditFin] = useState("");
  const [editAddress, setEditAddress] = useState("");

  function openEdit() {
    if (!customer) return;
    setEditFirstName(customer.firstName);
    setEditLastName(customer.lastName);
    setEditPhone(customer.phone);
    setEditFin(customer.fin ?? "");
    setEditAddress(customer.address ?? "");
    setEditOpen(true);
  }

  async function handleSaveCustomer(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username,
        password: adminPassword,
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        fin: editFin,
        address: editAddress,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: "Sakin məlumatları yeniləndi" });
    qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(Number(id)) });
  }

  if (isLoading) {
    return <AppLayout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (isError || !customer) {
    return <AppLayout><div className="text-center text-destructive p-12">Sakin tapılmadı</div></AppLayout>;
  }

  const rentals = (customer as any).rentals ?? [];
  const sales = customer.sales ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Sakin Profili</h1>
            <p className="text-muted-foreground mt-1">#{customer.id} - {customer.firstName} {customer.lastName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile card */}
          <Card className="border-none shadow-lg shadow-black/5 md:col-span-1 h-fit">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center border-b border-border/50 pb-6 mb-6 relative">
                {isAdmin && (
                  <Button size="icon" variant="ghost"
                    className="absolute top-0 right-0 h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={openEdit}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
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

                {/* Summary stats */}
                <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-muted/60 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{sales.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Satınalma</p>
                  </div>
                  <div className="bg-muted/60 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{rentals.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">İcarə</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="md:col-span-2 space-y-6">
            {/* Sales */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Satınalma Tarixçəsi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Bu sakinin satınalması yoxdur.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarix</TableHead>
                        <TableHead>Aktiv</TableHead>
                        <TableHead>Ödəniş Kodu</TableHead>
                        <TableHead>Növ</TableHead>
                        <TableHead className="text-right">Ümumi</TableHead>
                        <TableHead className="text-right">Ödənilib</TableHead>
                        <TableHead className="text-right">Borc</TableHead>
                        <TableHead className="w-[90px]">İrəliləyiş</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell className="text-sm">{format(new Date(sale.saleDate), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="font-medium">{sale.assetDescription}</TableCell>
                          <TableCell>
                            {sale.paymentCode ? (
                              <div className="flex items-center gap-1.5">
                                <Key className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="font-mono text-xs tracking-wider text-foreground select-all">
                                  {sale.paymentCode}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
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
                              <span className="text-xs text-muted-foreground">{sale.progressPercent ?? 0}%</span>
                              <Progress value={sale.progressPercent ?? 0} className="h-1.5 bg-slate-100" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Rentals */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  İcarə Müqavilələri
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rentals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Bu sakinin icarə müqaviləsi yoxdur.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aktiv</TableHead>
                        <TableHead>Başlanğıc</TableHead>
                        <TableHead>Bitmə</TableHead>
                        <TableHead className="text-right">Aylıq</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental: any) => (
                        <TableRow key={rental.id}>
                          <TableCell className="font-medium">{rental.assetDescription}</TableCell>
                          <TableCell className="text-sm">{format(new Date(rental.startDate), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="text-sm">{format(new Date(rental.endDate), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="text-right font-bold text-blue-700">{formatCurrency(rental.monthlyAmount)}</TableCell>
                          <TableCell><RentalStatusBadge status={rental.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Sakini Redaktə et" onSave={handleSaveCustomer}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ad</label>
              <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Soyad</label>
              <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                className="rounded-xl h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefon</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                className="rounded-xl h-11" placeholder="+994..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">FIN Kod</label>
              <Input value={editFin} onChange={(e) => setEditFin(e.target.value)}
                className="rounded-xl h-11" maxLength={7} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ünvan</label>
            <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
              className="rounded-xl h-11" />
          </div>
        </div>
      </AdminEditDialog>
    </AppLayout>
  );
}
