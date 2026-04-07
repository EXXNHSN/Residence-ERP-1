import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  AlertCircle, TrendingUp, Home, Key, Users, Store,
  Zap, Building2, CircleDollarSign, Car,
  ChevronDown, ChevronUp, Wallet, Loader2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

const AZ_MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

function useStats(quarterId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const url = quarterId && quarterId !== "all"
      ? `${BASE()}/api/stats/summary?quarterId=${quarterId}`
      : `${BASE()}/api/stats/summary`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [quarterId]);

  return { data, loading, error };
}

function SectionAccordion({
  icon: Icon,
  iconColor,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: any; iconColor: string; title: string;
  badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/50 shadow-sm bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2.5 font-semibold text-foreground">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
          {badge}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

function StatCard({ bg, iconBg, iconColor, Icon, label, value, sub, subColor }: {
  bg: string; iconBg: string; iconColor: string; Icon: any;
  label: string; value: string | number; sub?: string; subColor?: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3.5 flex items-start gap-3`}>
      <div className={`${iconBg} rounded-xl p-2 shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-lg font-bold text-foreground mt-0.5 truncate">{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${subColor ?? "text-muted-foreground"}`}>{sub}</p>}
      </div>
    </div>
  );
}

function RevenueRow({ label, total, received, debt, received_label, debt_label }: {
  label: string; total: number; received: number; debt: number;
  received_label?: string; debt_label?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border/40 last:border-0">
      <span className="text-sm font-medium text-foreground w-40 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-2 flex-1">
        <div className="bg-muted/60 rounded-lg px-3 py-1.5 flex-1 min-w-[120px]">
          <p className="text-[10px] text-muted-foreground">Ümumi Satış</p>
          <p className="text-sm font-bold">{formatCurrency(total)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex-1 min-w-[120px]">
          <p className="text-[10px] text-emerald-600">{received_label ?? "Daxil Olan"}</p>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(received)}</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 flex-1 min-w-[120px]">
          <p className="text-[10px] text-rose-600">{debt_label ?? "Qalıq Borc"}</p>
          <p className="text-sm font-bold text-rose-700">{formatCurrency(debt)}</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <Skeleton className="h-16 w-full rounded-xl" />;
}

export default function Dashboard() {
  const [quarterId, setQuarterId] = useState("all");
  const { data: stats, loading, error } = useStats(quarterId);

  const quarters: any[] = stats?.quarters ?? [];

  if (error) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-destructive">
          Məlumatları yükləmək mümkün olmadı
        </div>
      </AppLayout>
    );
  }

  // ── Derived values ──
  const s = stats ?? {};

  const aptDebt = (s.aptTotalReceived != null && s.aptTotalReceived < s.garageSaleRevenue + s.aptTotalReceived)
    ? (s.aptCashSales ?? 0) * 0 + 0  // placeholder
    : 0;

  // Apartment sales: total = sum of all apartment sales totalAmount
  const aptSaleTotal = s.cashSalesRevenue != null
    ? (s.cashSalesRevenue || 0) + (s.downPaymentRevenue || 0) + (s.creditInstallmentIncome || 0) +
      // Outstanding credit remaining (not received yet)
      0
    : 0;

  // Simpler: received is aptTotalReceived, debt = salesTotal - received
  // We don't have salesTotal directly — approximate as received + outstanding
  const aptReceived = s.aptTotalReceived ?? 0;
  // We compute total apt sale value from sales records — not available directly, use received for now
  const aptSalesGrandTotal = aptReceived; // we only show "received", "pending" separately

  const objReceived = s.objectTotalReceived ?? 0;
  const garReceived = s.garageTotalReceived ?? 0;

  // Monthly income sources
  const monthlyInstallment = s.monthlyInstallmentIncome ?? 0;
  const monthlyObjRental = s.monthlyObjectRentalIncome ?? 0;
  const monthlyGarRental = s.monthlyGarageRentalIncome ?? 0;
  const monthlyCommunal = s.monthlyCommunalIncome ?? 0;
  const totalMonthly = monthlyInstallment + monthlyObjRental + monthlyGarRental + monthlyCommunal;

  // Chart data
  const projections: any[] = s.installmentProjections ?? [];
  const chartData = projections.map((p: any) => ({
    name: `${AZ_MONTHS[p.month - 1]} ${String(p.year).slice(2)}`,
    amount: p.expected,
  }));

  // Object rentals count
  const objRentalCount = s.activeRentals ?? 0;

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">İdarə Paneli</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Naxçıvan Residence — maliyyə icmalı</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={quarterId} onValueChange={setQuarterId}>
              <SelectTrigger className="w-[200px] rounded-xl bg-card h-9 text-sm">
                <SelectValue placeholder="Kvartal seçin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Kvartallar</SelectItem>
                {quarters.map((q: any) => (
                  <SelectItem key={q.id} value={q.id.toString()}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* ── Quick Stats Bar ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              bg="bg-emerald-50 border border-emerald-100"
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              Icon={Home}
              label="Satılmış Mənzil"
              value={`${s.soldApartments ?? 0} / ${s.totalApartments ?? 0}`}
              sub={`Boş: ${s.availableApartments ?? 0}`}
            />
            <StatCard
              bg="bg-blue-50 border border-blue-100"
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              Icon={Users}
              label="Cəmi Sakin"
              value={s.totalCustomers ?? 0}
              sub="Qeydiyyatda"
            />
            <StatCard
              bg="bg-amber-50 border border-amber-100"
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              Icon={AlertCircle}
              label="Gecikmiş Taksit"
              value={s.overdueInstallments ?? 0}
              sub={s.overdueInstallments > 0 ? "Təcili" : "Hamısı vaxtında"}
              subColor={s.overdueInstallments > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}
            />
            <StatCard
              bg="bg-violet-50 border border-violet-100"
              iconBg="bg-violet-100"
              iconColor="text-violet-600"
              Icon={Zap}
              label="Kommunal Gözlənilən"
              value={s.pendingCommunalBills ?? 0}
              sub="Ödənilməmiş"
            />
          </div>
        )}

        {/* ── Aylıq Gəlir Xülasəsi ── */}
        {loading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : (
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Bu ay cəmi daxil olan</p>
                <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(totalMonthly)}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Taksitlər</p>
                  <p className="font-bold text-foreground">{formatCurrency(monthlyInstallment)}</p>
                </div>
                <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">İcarə</p>
                  <p className="font-bold text-foreground">{formatCurrency(monthlyObjRental + monthlyGarRental)}</p>
                </div>
                <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Kommunal</p>
                  <p className="font-bold text-foreground">{formatCurrency(monthlyCommunal)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 1: Satış Gəliri ── */}
        <SectionAccordion
          icon={CircleDollarSign}
          iconColor="text-blue-600"
          title="Satış Gəliri"
          defaultOpen={true}
          badge={
            !loading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Cəmi: {formatCurrency((s.aptTotalReceived ?? 0) + (s.objectTotalReceived ?? 0) + (s.garageTotalReceived ?? 0))} daxil olub
              </span>
            )
          }
        >
          {loading ? (
            <div className="space-y-2 pt-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="pt-2 space-y-1">
              {/* Mənzil */}
              <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-600" />
                  <p className="font-semibold text-sm text-blue-700">Mənzil Satışı</p>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({(s.aptCashSales ?? 0) + (s.aptCreditSales ?? 0)} müqavilə:
                    {s.aptCashSales ?? 0} nağd, {s.aptCreditSales ?? 0} kredit)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Nağd Satış</p>
                    <p className="text-sm font-bold">{formatCurrency(s.cashSalesRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-emerald-600">İlkin Ödəniş</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(s.downPaymentRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Taksit Gəliri</p>
                    <p className="text-sm font-bold">{formatCurrency(s.creditInstallmentIncome ?? 0)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-blue-100/60 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-blue-700">Cəmi Daxil Olan:</span>
                  <span className="font-bold text-blue-700">{formatCurrency(aptReceived)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Gözlənilən taksit (bu ay):</span>
                  <span className="text-sm font-semibold text-amber-600">{formatCurrency(s.monthlyPendingAmount ?? 0)}</span>
                </div>
              </div>

              {/* Qeyri Yaşayış */}
              <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600" />
                  <p className="font-semibold text-sm text-amber-700">Qeyri Yaşayış Satışı</p>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({(s.objectCashSales ?? 0) + (s.objectCreditSales ?? 0)} müqavilə)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Ümumi Dəyər</p>
                    <p className="text-sm font-bold">{formatCurrency(s.objectSaleRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-emerald-600">Daxil Olan</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(objReceived)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Taksit gəliri:</span>
                  <span className="text-xs font-semibold">{formatCurrency(s.objectInstallmentIncome ?? 0)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">Satılmış:</span>
                  <span className="text-xs font-semibold">{s.soldObjects ?? 0} / {s.totalObjects ?? 0}</span>
                </div>
              </div>

              {/* Avto Dayanacaq */}
              <div className="rounded-xl bg-violet-50/50 border border-violet-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-violet-600" />
                  <p className="font-semibold text-sm text-violet-700">Avto Dayanacaq Satışı</p>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({(s.garageCashSales ?? 0) + (s.garageCreditSales ?? 0)} müqavilə)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Ümumi Dəyər</p>
                    <p className="text-sm font-bold">{formatCurrency(s.garageSaleRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-emerald-600">Daxil Olan</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(garReceived)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Satılmış:</span>
                  <span className="text-xs font-semibold">{s.soldGarages ?? 0}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">Taksit gəliri:</span>
                  <span className="text-xs font-semibold">{formatCurrency(s.garageInstallmentIncome ?? 0)}</span>
                </div>
              </div>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 2: İcarə Gəliri ── */}
        <SectionAccordion
          icon={Key}
          iconColor="text-emerald-600"
          title="İcarə Gəliri"
          defaultOpen={true}
          badge={
            !loading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Aylıq: {formatCurrency(monthlyObjRental + monthlyGarRental)}
              </span>
            )
          }
        >
          {loading ? (
            <div className="space-y-2 pt-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : (
            <div className="pt-2 space-y-1">
              {/* Qeyri Yaşayış İcarəsi */}
              <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-amber-600" />
                    <p className="font-semibold text-sm text-amber-700">Qeyri Yaşayış İcarəsi</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Aktiv: {s.rentedObjects ?? 0}</p>
                    <p className="font-bold text-amber-700">{formatCurrency(monthlyObjRental)} / ay</p>
                  </div>
                </div>
              </div>

              {/* Avto Dayanacaq İcarəsi */}
              <div className="rounded-xl bg-violet-50/50 border border-violet-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-violet-600" />
                    <p className="font-semibold text-sm text-violet-700">Avto Dayanacaq İcarəsi</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Aktiv: {s.rentedGarages ?? 0}</p>
                    <p className="font-bold text-violet-700">{formatCurrency(monthlyGarRental)} / ay</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 3: Kommunal Xidmət ── */}
        <SectionAccordion
          icon={Zap}
          iconColor="text-violet-600"
          title="Kommunal Xidmət"
          badge={
            !loading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Bu ay: {formatCurrency(monthlyCommunal)}
              </span>
            )
          }
        >
          {loading ? (
            <Skeleton className="h-20 w-full rounded-xl mt-3" />
          ) : (
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5">
                  <p className="text-xs text-violet-600">Bu ay ödənilmiş</p>
                  <p className="text-xl font-bold text-violet-700 mt-1">{formatCurrency(monthlyCommunal)}</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5">
                  <p className="text-xs text-rose-600">Ödənilməmiş hesab</p>
                  <p className="text-xl font-bold text-rose-700 mt-1">{s.pendingCommunalBills ?? 0}</p>
                  <p className="text-xs text-rose-500 mt-0.5">{formatCurrency(s.totalPendingCommunalAmount ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Mənzil təhvil verilmiş: {s.handedOverApartments ?? 0} /{" "}
                  {s.soldApartments ?? 0}
                </span>
              </div>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 4: Gözlənilən Taksitlər ── */}
        {!loading && chartData.length > 0 && (
          <SectionAccordion
            icon={TrendingUp}
            iconColor="text-primary"
            title="Gözlənilən Taksit Ödənişləri"
            badge={
              <span className="ml-2 text-xs font-normal text-muted-foreground">növbəti 3 ay</span>
            }
          >
            <div className="pt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v), "Gözlənilən"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionAccordion>
        )}

        {/* ── Summary Links ── */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Satışlar", href: "/sales", icon: CircleDollarSign, color: "text-blue-600 bg-blue-50", val: `${s.totalSales ?? 0} müq.` },
              { label: "İcarə", href: "/rentals", icon: Key, color: "text-emerald-600 bg-emerald-50", val: `${s.activeRentals ?? 0} aktiv` },
              { label: "Kommunal", href: "/communal", icon: Zap, color: "text-violet-600 bg-violet-50", val: `${s.pendingCommunalBills ?? 0} gözlənir` },
              { label: "Sakinlər", href: "/customers", icon: Users, color: "text-sky-600 bg-sky-50", val: `${s.totalCustomers ?? 0} nəfər` },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`${item.color} rounded-xl px-4 py-3 flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs opacity-70">{item.label}</p>
                      <p className="text-sm font-bold">{item.val}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
