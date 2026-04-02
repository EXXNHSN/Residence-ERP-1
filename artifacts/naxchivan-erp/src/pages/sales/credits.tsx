import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListSales, useListInstallments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Download, TrendingUp, Wallet, CalendarDays, Users } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { format, addMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { az } from "date-fns/locale";
import * as XLSX from "xlsx";

export default function CreditReportPage() {
  const { data: allSales, isLoading: salesLoading } = useListSales();
  const { data: allInstallments, isLoading: instLoading } = useListInstallments();

  const [rangeStart, setRangeStart] = useState(() => format(new Date(), "yyyy-MM"));
  const [rangeEnd, setRangeEnd] = useState(() => format(addMonths(new Date(), 5), "yyyy-MM"));

  const creditSales = useMemo(() => {
    if (!allSales) return [];
    return allSales.filter((s: any) => s.saleType === "credit");
  }, [allSales]);

  const totalOutstanding = useMemo(() => creditSales.reduce((sum, s: any) => sum + Number(s.remainingAmount), 0), [creditSales]);
  const totalMonthly = useMemo(() => creditSales.reduce((sum, s: any) => sum + Number(s.monthlyPayment), 0), [creditSales]);
  const totalCreditAmount = useMemo(() => creditSales.reduce((sum, s: any) => sum + Number(s.totalAmount), 0), [creditSales]);

  const monthlyBreakdown = useMemo(() => {
    if (!allInstallments) return [];
    const start = parseISO(`${rangeStart}-01`);
    const endDate = parseISO(`${rangeEnd}-01`);
    const months: { label: string; date: Date; pending: number; paid: number; total: number; count: number }[] = [];
    let cur = startOfMonth(start);
    while (cur <= endDate) {
      const from = startOfMonth(cur);
      const to = endOfMonth(cur);
      const inRange = (allInstallments as any[]).filter((inst: any) => {
        const due = parseISO(inst.dueDate);
        return isWithinInterval(due, { start: from, end: to });
      });
      const pending = inRange.filter((i: any) => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + Number(i.amount), 0);
      const paid = inRange.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
      months.push({
        label: format(cur, "MMMM yyyy", { locale: az }),
        date: cur,
        pending,
        paid,
        total: pending + paid,
        count: inRange.length,
      });
      cur = addMonths(cur, 1);
    }
    return months;
  }, [allInstallments, rangeStart, rangeEnd]);

  const totalExpectedInRange = useMemo(() => monthlyBreakdown.reduce((s, m) => s + m.pending, 0), [monthlyBreakdown]);

  function exportExcel() {
    const rows = creditSales.map((s: any) => ({
      "Ad Soyad": s.customerName,
      "Mobil Nömrə": s.customerPhone ?? "—",
      "Aylıq Ödəniş (AZN)": Number(s.monthlyPayment),
      "Qalıq Borc (AZN)": Number(s.remainingAmount),
      "Ümumi Məbləğ (AZN)": Number(s.totalAmount),
      "Satış Tarixi": format(parseISO(s.saleDate), "dd.MM.yyyy"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kredit Müştərilər");
    XLSX.writeFile(wb, `kredit-mushteriler-${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  }

  const isLoading = salesLoading || instLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/sales" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-display font-bold text-foreground">Kredit Hesabat</h1>
            <p className="text-muted-foreground mt-1">Kreditlə alınan mənzillərin ödəniş statistikası</p>
          </div>
          <Button onClick={exportExcel} disabled={creditSales.length === 0}
            className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel Export
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "Kredit Müştəri", value: creditSales.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                { title: "Ümumi Kredit", value: formatCurrency(totalCreditAmount), icon: Wallet, color: "text-violet-600", bg: "bg-violet-50" },
                { title: "Aylıq Gəlir", value: formatCurrency(totalMonthly), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                { title: "Qalıq Borc", value: formatCurrency(totalOutstanding), icon: CalendarDays, color: "text-amber-600", bg: "bg-amber-50" },
              ].map((card, i) => (
                <Card key={i} className="border-none shadow-md shadow-black/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.title}</p>
                      <p className="text-lg font-bold">{card.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">Aylıq Ödəniş Gözləntiləri</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Başlanğıc:</span>
                      <Input type="month" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                        className="h-8 rounded-lg text-xs w-36 border-border/60" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Son:</span>
                      <Input type="month" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                        className="h-8 rounded-lg text-xs w-36 border-border/60" />
                    </div>
                  </div>
                </div>
                {totalExpectedInRange > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Seçilən dövrdə gözlənilən ümumi gəlir:
                    <span className="ml-1.5 font-semibold text-emerald-600">{formatCurrency(totalExpectedInRange)}</span>
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Ay</TableHead>
                      <TableHead className="text-right">Gözlənilən (AZN)</TableHead>
                      <TableHead className="text-right">Ödənilmiş (AZN)</TableHead>
                      <TableHead className="text-right">Taksit sayı</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyBreakdown.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Bu dövrdə məlumat yoxdur</TableCell></TableRow>
                    ) : (
                      monthlyBreakdown.map((m, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="font-medium capitalize">{m.label}</TableCell>
                          <TableCell className="text-right">
                            {m.pending > 0
                              ? <span className="font-semibold text-amber-600">{formatCurrency(m.pending)}</span>
                              : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.paid > 0
                              ? <span className="font-semibold text-emerald-600">{formatCurrency(m.paid)}</span>
                              : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{m.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-base">Kredit Müştərilər Siyahısı</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Müştəri</TableHead>
                      <TableHead>Aktiv</TableHead>
                      <TableHead className="text-right">Ümumi</TableHead>
                      <TableHead className="text-right">Aylıq Ödəniş</TableHead>
                      <TableHead className="text-right">Qalıq Borc</TableHead>
                      <TableHead className="text-right">İrəliləyiş</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditSales.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Kredit satış yoxdur</TableCell></TableRow>
                    ) : (
                      creditSales.map((s: any) => (
                        <TableRow key={s.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Link href={`/customers/${s.customerId}`} className="font-semibold hover:text-primary transition-colors">
                              {s.customerName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.assetDescription}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(s.totalAmount)}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">{formatCurrency(s.monthlyPayment)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${s.remainingAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {formatCurrency(s.remainingAmount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(s.progressPercent, 100)}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(s.progressPercent)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
