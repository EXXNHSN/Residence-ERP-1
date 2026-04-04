import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, AlertCircle, TrendingUp, Home, Key, Wifi, CreditCard,
  Users, Store, Zap, Building2, CheckCircle2, CircleDollarSign,
  Banknote, ArrowRight, Car, Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";

function SectionAccordion({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: any;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/50 shadow-sm shadow-black/5 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2.5 font-semibold text-foreground">
          <Icon className="w-5 h-5 text-primary" />
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

function RevenueCard({ icon: Icon, iconBg, iconColor, label, amount, sub }: {
  icon: any; iconBg: string; iconColor: string; label: string; amount: number; sub: string
}) {
  return (
    <Card className="border border-border/40 shadow-none">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <h3 className="text-base font-bold text-foreground mt-0.5">{formatCurrency(amount)}</h3>
          <p className={`text-xs mt-0.5 ${iconColor}`}>{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStatCard({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetDashboardStats();

  if (isError) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-destructive">
          Məlumatları yükləmək mümkün olmadı
        </div>
      </AppLayout>
    );
  }

  const apartmentData = stats ? [
    { name: "Satılıb", value: stats.soldApartments, color: "#10b981" },
    { name: "Boşdur", value: stats.availableApartments, color: "#3b82f6" },
    { name: "Rezerv", value: stats.reservedApartments, color: "#f59e0b" },
  ] : [];

  const totalMonthly =
    ((stats as any)?.monthlyApartmentCommunalIncome ?? 0) +
    ((stats as any)?.monthlyGarageRentBillsIncome ?? 0) +
    ((stats as any)?.monthlyObjectRentalIncome ?? 0) +
    (stats?.monthlyInstallmentIncome ?? 0);

  return (
    <AppLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">İdarə Paneli</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Naxçıvan Residence — ümumi statistika</p>
          </div>
          {!isLoading && stats && (
            <div className="text-right hidden md:block">
              <p className="text-xs text-muted-foreground">Aylıq Ümumi Gəlir</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalMonthly)}</p>
            </div>
          )}
        </div>

        {/* Quick Stats Bar */}
        {!isLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <Home className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs text-emerald-600">Satılmış Mənzil</p>
                <p className="font-bold text-emerald-700 text-lg">{stats.soldApartments}</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-blue-600">Sakin</p>
                <p className="font-bold text-blue-700 text-lg">{stats.totalCustomers}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs text-amber-600">Gecikmiş Taksit</p>
                <p className="font-bold text-amber-700 text-lg">{stats.overdueInstallments ?? 0}</p>
              </div>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <Zap className="w-5 h-5 text-violet-600 shrink-0" />
              <div>
                <p className="text-xs text-violet-600">Gözlənilən Kommunal</p>
                <p className="font-bold text-violet-700 text-lg">{stats.pendingCommunalBills}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 1: Mənzil Satış Gəliri ── */}
        <SectionAccordion icon={CircleDollarSign} title="Mənzil Satış Gəliri" defaultOpen={true}>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <RevenueCard icon={Banknote} iconBg="bg-emerald-100/60" iconColor="text-emerald-600"
                  label="Nağd Satış (mənzil)"
                  amount={(stats as any)?.cashSalesRevenue ?? 0}
                  sub={`${(stats as any)?.aptCashSales ?? 0} mənzil nağd satılıb`} />
                <RevenueCard icon={Wallet} iconBg="bg-blue-100/60" iconColor="text-blue-600"
                  label="İlkin Ödəniş (kredit)"
                  amount={(stats as any)?.downPaymentRevenue ?? 0}
                  sub={`${(stats as any)?.aptCreditSales ?? 0} mənzil kreditlə`} />
                <RevenueCard icon={CreditCard} iconBg="bg-violet-100/60" iconColor="text-violet-600"
                  label="Kredit Taksit Gəliri"
                  amount={(stats as any)?.creditInstallmentIncome ?? 0}
                  sub={`Mənzil cəmi: ${formatCurrency(((stats as any)?.aptTotalReceived ?? 0))}`} />
              </div>
              {/* Grand total bar */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Bütün aktivlər üzrə toplam daxil olan gəlir</span>
                  <span className="text-xs text-muted-foreground/60">(mənzil + qaraj + qeyri yaşayış)</span>
                </div>
                <span className="text-xl font-bold text-primary">{formatCurrency((stats as any)?.grandTotalReceived ?? 0)}</span>
              </div>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 2: Kredit Taksit Statistikası ── */}
        <SectionAccordion icon={TrendingUp} title="Kredit Aylıq Ödəniş Statistikası">
          {isLoading ? (
            <Skeleton className="h-32 w-full mt-3 rounded-xl" />
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs text-amber-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Bu Ay Gözlənilən
                  </p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(stats?.monthlyPendingAmount ?? 0)}</p>
                  <p className="text-xs text-amber-400 mt-0.5">Ödənilməyən taksitlər</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Bu Ay Ödənildi
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(stats?.monthlyInstallmentIncome ?? 0)}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Daxil olan gəlir</p>
                </div>
                {(stats?.installmentProjections ?? []).slice(0, 2).map((proj: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-medium">{i === 0 ? "Növbəti ay" : "2 ay sonra"} — {proj.month}/{proj.year}</p>
                    <p className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(proj.expected)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gözlənilən taksit</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm pt-1">
                <span className="text-rose-600 font-medium">{stats?.overdueInstallments ?? 0}</span>
                <span className="text-muted-foreground">gecikmiş taksit</span>
                <span className="mx-2 text-border">·</span>
                <Link href="/sales/credits" className="text-primary hover:text-primary/80 flex items-center gap-1 transition-colors text-xs">
                  Kredit hesabatı <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 3: Avto Dayanacaq ── */}
        <SectionAccordion icon={Car} title="Avto Dayanacaq Statistikası">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" /> Dayanacaq Yerləri
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniStatCard label="Boş" value={(stats as any)?.availableGarages ?? 0} color="bg-blue-50 text-blue-700" />
                    <MiniStatCard label="Satılıb" value={(stats as any)?.soldGarages ?? 0} color="bg-emerald-50 text-emerald-700" />
                    <MiniStatCard label="İcarədə" value={(stats as any)?.rentedGarages ?? 0} color="bg-violet-50 text-violet-700" />
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/30">
                    <span className="text-xs text-muted-foreground">Cəmi yer</span>
                    <span className="font-bold text-sm">{(stats as any)?.totalGarages ?? 0}</span>
                  </div>
                  <Link href="/garages" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-2">
                    İdarə et <ArrowRight className="w-3 h-3" />
                  </Link>
                </CardContent>
              </Card>
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100/60 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Satış Gəliri</p>
                    <h3 className="text-base font-bold mt-0.5">{formatCurrency((stats as any)?.garageSaleRevenue ?? 0)}</h3>
                    <p className="text-xs text-emerald-600 mt-0.5">{(stats as any)?.soldGarages ?? 0} satılmış</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-violet-100/60 flex items-center justify-center shrink-0">
                    <Key className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">İcarə Gəliri (Aylıq)</p>
                    <h3 className="text-base font-bold mt-0.5">{formatCurrency((stats as any)?.monthlyGarageRentalIncome ?? 0)}</h3>
                    <p className="text-xs text-violet-600 mt-0.5">{(stats as any)?.rentedGarages ?? 0} aktiv icarə</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 4: Kommunal + İcarə ── */}
        <SectionAccordion icon={Zap} title="Kommunal və İcarə Gəliri">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100/60 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Mənzil Kommunal (bu ay)</p>
                  </div>
                  <p className="text-base font-bold">{formatCurrency((stats as any)?.monthlyApartmentCommunalIncome ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats?.pendingCommunalBills ?? 0} faktura</p>
                </CardContent>
              </Card>
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100/60 flex items-center justify-center">
                      <Car className="w-4 h-4 text-violet-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Avto Dayanacaq İcarə (bu ay)</p>
                  </div>
                  <p className="text-base font-bold">{formatCurrency((stats as any)?.monthlyGarageRentBillsIncome ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ayrı göstərilir</p>
                </CardContent>
              </Card>
              <Card className="border border-border/40 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100/60 flex items-center justify-center">
                      <Store className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Qeyri Yaşayış İcarə (aylıq)</p>
                  </div>
                  <p className="text-base font-bold">{formatCurrency((stats as any)?.monthlyObjectRentalIncome ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(stats as any)?.rentedObjects ?? 0} icarədə</p>
                </CardContent>
              </Card>
              <Card className="border border-border/40 shadow-none bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CircleDollarSign className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs text-primary/80 font-medium">Ümumi Aylıq Gəlir</p>
                  </div>
                  <p className="text-base font-bold text-primary">{formatCurrency(totalMonthly)}</p>
                  <p className="text-xs text-primary/60 mt-1">Kommunal + İcarə + Taksit</p>
                </CardContent>
              </Card>
            </div>
          )}
        </SectionAccordion>

        {/* ── Section 5: Mənzil Statistikası ── */}
        <SectionAccordion icon={Home} title="Mənzil Statistikası">
          {isLoading ? (
            <Skeleton className="h-64 w-full mt-3 rounded-xl" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
              <div className="lg:col-span-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apartmentData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {apartmentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {[
                  { icon: Users, label: "Sakinlər", value: stats?.totalCustomers },
                  { icon: Home, label: "Satılmış Mənzil", value: stats?.soldApartments, cls: "text-emerald-600" },
                  { icon: CheckCircle2, label: "Tehvil Edilmiş", value: stats?.handedOverApartments, cls: "text-blue-600" },
                  { icon: Store, label: "Qeyri Yaşayış", value: `${(stats as any).soldObjects ?? 0} / ${stats?.totalObjects}` },
                  { icon: Car, label: "Avto Dayanacaq", value: `${((stats as any).soldGarages ?? 0) + ((stats as any).rentedGarages ?? 0)} / ${(stats as any).totalGarages ?? 0}` },
                  { icon: Wifi, label: "İnternet Abunə", value: stats?.activeInternetSubscriptions },
                ].map(({ icon: I, label, value, cls }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <I className="w-3.5 h-3.5" /> {label}
                    </span>
                    <span className={`font-bold ${cls ?? ""}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionAccordion>
      </div>
    </AppLayout>
  );
}
