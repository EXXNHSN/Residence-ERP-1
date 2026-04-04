import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Search, Loader2, Phone, Store, CalendarDays, Banknote, Link as LinkIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

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

export default function RentersPage() {
  const [search, setSearch] = useState("");

  const { data: renters, isLoading } = useQuery({
    queryKey: ["renters"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/renters`);
      return res.json();
    },
  });

  const filtered = (renters ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.firstName?.toLowerCase().includes(q) ||
      r.lastName?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.fin?.toLowerCase().includes(q)
    );
  });

  const activeCount = (renters ?? []).filter((r: any) =>
    r.rentals?.some((rent: any) => rent.status === "active")
  ).length;

  const totalMonthly = (renters ?? []).reduce((sum: number, r: any) => {
    return sum + r.rentals
      .filter((rent: any) => rent.status === "active")
      .reduce((s: number, rent: any) => s + Number(rent.monthlyAmount), 0);
  }, 0);

  return (
    <TooltipProvider>
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Arendatorlar</h1>
              <p className="text-muted-foreground mt-1">Qeyri yaşayış sahəsi icarəçiləri reyestri</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Ad, FIN, telefon axtar..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl bg-card border-none shadow-sm" />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cəmi Arendator</p>
              <p className="text-3xl font-bold text-foreground mt-1">{renters?.length ?? 0}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aktiv İcarəçi</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{activeCount}</p>
            </div>
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 shadow-sm">
              <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Aylıq Gəlir (aktiv)</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(totalMonthly)}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Arendator</TableHead>
                    <TableHead>FIN</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>İcarə Obyekti</TableHead>
                    <TableHead>Müddət</TableHead>
                    <TableHead className="text-right">Aylıq</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        Arendator tapılmadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.flatMap((renter: any) =>
                      renter.rentals.map((rental: any, ri: number) => (
                        <TableRow key={`${renter.id}-${rental.id}`} className="hover:bg-muted/30 transition-colors">
                          {ri === 0 && (
                            <TableCell rowSpan={renter.rentals.length}>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm shrink-0">
                                  {renter.firstName[0]}{renter.lastName[0]}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground text-sm">
                                    {renter.firstName} {renter.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">#{renter.id}</div>
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {ri === 0 && (
                            <TableCell rowSpan={renter.rentals.length}>
                              {renter.fin
                                ? <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded-lg">{renter.fin}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          {ri === 0 && (
                            <TableCell rowSpan={renter.rentals.length}>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                <Phone className="w-3.5 h-3.5 shrink-0" /> {renter.phone}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                <Store className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <span className="text-sm font-medium">
                                {rental.objectType === "garage"
                                  ? `Avto Dayanacaq ${rental.objectNumber ?? rental.assetId}`
                                  : `Qeyri Yaşayış ${rental.objectNumber ?? rental.assetId}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              {format(new Date(rental.startDate), 'dd.MM.yy')} — {format(new Date(rental.endDate), 'dd.MM.yy')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 text-amber-700 font-bold text-sm">
                              <Banknote className="w-3.5 h-3.5" />
                              {formatCurrency(rental.monthlyAmount)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <RentalStatusBadge status={rental.status} />
                          </TableCell>
                          {ri === 0 && (
                            <TableCell rowSpan={renter.rentals.length} className="text-right">
                              <Link href={`/customers/${renter.id}`} className="text-primary hover:underline text-sm font-medium">
                                Profil
                              </Link>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </AppLayout>
    </TooltipProvider>
  );
}
