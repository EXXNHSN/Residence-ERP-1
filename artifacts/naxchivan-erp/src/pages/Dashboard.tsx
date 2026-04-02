import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { 
  Wallet, 
  AlertCircle, 
  TrendingUp, 
  Home, 
  Key, 
  Wifi, 
  CreditCard,
  Users,
  Store,
  Zap,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Banknote,
  ArrowRight,
  Car,
  Lock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";

function StatRow({ icon: Icon, label, value, valueClass = "", children }: {
  icon: any; label: string; value: React.ReactNode; valueClass?: string; children?: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center pb-3 border-b border-border/50 last:border-0 last:pb-0">
      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4" /> {label}
      </span>
      <div className="text-right">
        <span className={`font-bold text-lg ${valueClass}`}>{value}</span>
        {children}
      </div>
    </div>
  );
}

function RevenueCard({ icon: Icon, iconBg, iconColor, label, amount, sub }: {
  icon: any; iconBg: string; iconColor: string; label: string; amount: number; sub: string
}) {
  return (
    <Card className="border-none shadow-lg shadow-black/5">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-7 h-7 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(amount)}</h3>
          <p className={`text-xs mt-0.5 ${iconColor}`}>{sub}</p>
        </div>
      </CardContent>
    </Card>
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

  const garageData = stats ? [
    { name: "Boş", value: (stats as any).availableGarages ?? 0, color: "#3b82f6" },
    { name: "Satılıb", value: (stats as any).soldGarages ?? 0, color: "#10b981" },
    { name: "İcarədə", value: (stats as any).rentedGarages ?? 0, color: "#8b5cf6" },
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">İdarə Paneli</h1>
          <p className="text-muted-foreground mt-1">Naxçıvan Residence ümumi statistika və hesabatlar.</p>
        </div>

        {/* ── Mənzil Satış Gəliri ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4" /> Mənzil Satış Gəliri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            ) : (
              <>
                <RevenueCard icon={Banknote} iconBg="bg-emerald-100/60" iconColor="text-emerald-600"
                  label="Nağd Satış" amount={stats?.cashSalesRevenue ?? 0} sub={`${stats?.cashSales ?? 0} satış`} />
                <RevenueCard icon={Wallet} iconBg="bg-blue-100/60" iconColor="text-blue-600"
                  label="İlkin Ödəniş (Kredit)" amount={stats?.downPaymentRevenue ?? 0} sub={`${stats?.creditSales ?? 0} kredit müştəri`} />
                <RevenueCard icon={CreditCard} iconBg="bg-violet-100/60" iconColor="text-violet-600"
                  label="Kredit Taksit Gəliri" amount={stats?.creditInstallmentIncome ?? 0}
                  sub={`Cəmi: ${formatCurrency((stats?.cashSalesRevenue ?? 0) + (stats?.downPaymentRevenue ?? 0) + (stats?.creditInstallmentIncome ?? 0))}`} />
              </>
            )}
          </div>
        </div>

        {/* ── Kredit Taksit Statistikası ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Kredit Aylıq Ödəniş Statistikası
          </h2>
          <Card className="border-none shadow-lg shadow-black/5">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-amber-50 rounded-2xl p-4">
                  <p className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Bu Ay Gözlənilən
                  </p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(stats?.monthlyPendingAmount ?? 0)}</p>
                  <p className="text-xs text-amber-400 mt-0.5">Ödənilməyən taksitlər</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4">
                  <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bu Ay Ödənildi
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(stats?.monthlyInstallmentIncome ?? 0)}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Daxil olan gəlir</p>
                </div>
                {(stats?.installmentProjections ?? []).slice(0, 2).map((proj: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-medium">
                      {i === 0 ? "Növbəti ay" : "2 ay sonra"} — {proj.month}/{proj.year}
                    </p>
                    <p className="text-2xl font-bold text-slate-700 mt-1">{formatCurrency(proj.expected)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gözlənilən taksit</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-rose-600 font-medium">{stats?.overdueInstallments ?? 0}</span>
                <span className="text-muted-foreground">gecikmiş taksit</span>
                <span className="mx-2 text-border">·</span>
                <Link href="/sales/credits" className="text-primary hover:text-primary/80 flex items-center gap-1 transition-colors text-xs">
                  Kredit hesabatı <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Qaraj Statistikası ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Car className="w-4 h-4" /> Qaraj Statistikası və Gəliri
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Garage counts */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" /> Dayanacaq Yerləri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? <Skeleton className="h-24 w-full" /> : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-blue-600">{(stats as any)?.availableGarages ?? 0}</p>
                        <p className="text-xs text-blue-500 mt-0.5">Boş</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-emerald-600">{(stats as any)?.soldGarages ?? 0}</p>
                        <p className="text-xs text-emerald-500 mt-0.5">Satılıb</p>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-violet-600">{(stats as any)?.rentedGarages ?? 0}</p>
                        <p className="text-xs text-violet-500 mt-0.5">İcarədə</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <span className="text-xs text-muted-foreground">Cəmi dayanacaq yeri</span>
                      <span className="font-bold">{(stats as any)?.totalGarages ?? 0}</span>
                    </div>
                    <Link href="/garages" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      Qarajları idarə et <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Garage sale revenue */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100/60 flex items-center justify-center shrink-0">
                  <Lock className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Qaraj Satış Gəliri</p>
                  {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> : (
                    <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency((stats as any)?.garageSaleRevenue ?? 0)}</h3>
                  )}
                  <p className="text-xs text-emerald-600 mt-0.5">{(stats as any)?.soldGarages ?? 0} satılmış qaraj</p>
                </div>
              </CardContent>
            </Card>

            {/* Garage rental income */}
            <Card className="border-none shadow-lg shadow-black/5">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-100/60 flex items-center justify-center shrink-0">
                  <Key className="w-7 h-7 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Qaraj İcarə Gəliri (Aylıq)</p>
                  {isLoading ? <Skeleton className="h-7 w-28 mt-1" /> : (
                    <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency((stats as any)?.monthlyGarageRentalIncome ?? 0)}</h3>
                  )}
                  <p className="text-xs text-violet-600 mt-0.5">{(stats as any)?.rentedGarages ?? 0} aktiv icarə</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Kommunal + Obyekt İcarə ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Kommunal və İcarə Gəliri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
            ) : (
              <>
                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-100/60 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Mənzil Kommunal (bu ay)</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency((stats as any)?.monthlyApartmentCommunalIncome ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.pendingCommunalBills ?? 0} gözlənilən faktura</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-violet-100/60 flex items-center justify-center">
                        <Car className="w-5 h-5 text-violet-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Qaraj İcarə Ödənişi (bu ay)</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency((stats as any)?.monthlyGarageRentBillsIncome ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Kommunalda ayrı göstərilir</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-rose-100/60 flex items-center justify-center">
                        <Store className="w-5 h-5 text-rose-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Obyekt İcarə (aylıq)</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency((stats as any)?.monthlyObjectRentalIncome ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(stats as any)?.rentedObjects ?? 0} icarədə olan obyekt</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CircleDollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-sm text-primary/80 font-medium">Ümumi Aylıq Gəlir</p>
                    </div>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(
                        ((stats as any)?.monthlyApartmentCommunalIncome ?? 0) +
                        ((stats as any)?.monthlyGarageRentBillsIncome ?? 0) +
                        ((stats as any)?.monthlyObjectRentalIncome ?? 0) +
                        (stats?.monthlyInstallmentIncome ?? 0)
                      )}
                    </p>
                    <p className="text-xs text-primary/60 mt-1">Kommunal + İcarə + Taksit</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Mənzil Statistikası + Ümumi Məlumat ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 lg:col-span-2 border-none shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                Mənzil Statistikası
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <div className="h-[260px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={apartmentData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {apartmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Ümumi Statistika
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 mt-1">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : stats && (
                <>
                  <StatRow icon={Users} label="Müştərilər" value={stats.totalCustomers} />
                  <StatRow icon={Home} label="Satılmış Mənzil" value={stats.soldApartments} valueClass="text-emerald-600" />
                  <StatRow icon={CheckCircle2} label="Tehvil Edilmiş" value={stats.handedOverApartments} valueClass="text-blue-600" />
                  <StatRow icon={Store} label="Ticarət Obyekti" value={`${(stats as any).soldObjects ?? 0} / ${stats.totalObjects}`} />
                  <StatRow icon={Car} label="Qaraj" value={`${((stats as any).soldGarages ?? 0) + ((stats as any).rentedGarages ?? 0)} / ${(stats as any).totalGarages ?? 0}`} />
                  <StatRow icon={Wifi} label="İnternet Abunə" value={stats.activeInternetSubscriptions} />
                  <StatRow icon={Zap} label="Gözlənilən Kommunal" value={stats.pendingCommunalBills} valueClass="text-amber-600" />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
