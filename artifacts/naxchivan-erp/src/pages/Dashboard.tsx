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
  ArrowRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">İdarə Paneli</h1>
          <p className="text-muted-foreground mt-1">Naxçıvan Residence ümumi statistika və hesabatlar.</p>
        </div>

        {/* ── Satış Gəlir Bölməsi ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4" /> Mənzil Satış Gəliri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            ) : (
              <>
                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100/60 flex items-center justify-center shrink-0">
                      <Banknote className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nağd Satış</p>
                      <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(stats?.cashSalesRevenue ?? 0)}</h3>
                      <p className="text-xs text-emerald-600 mt-0.5">{stats?.cashSales ?? 0} satış</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-100/60 flex items-center justify-center shrink-0">
                      <Wallet className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">İlkin Ödəniş (Kredit)</p>
                      <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(stats?.downPaymentRevenue ?? 0)}</h3>
                      <p className="text-xs text-blue-600 mt-0.5">{stats?.creditSales ?? 0} kredit müştəri</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100/60 flex items-center justify-center shrink-0">
                      <CreditCard className="w-7 h-7 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Kredit Taksit Gəliri</p>
                      <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(stats?.creditInstallmentIncome ?? 0)}</h3>
                      <p className="text-xs text-violet-600 mt-0.5">Ümumi: {formatCurrency((stats?.cashSalesRevenue ?? 0) + (stats?.downPaymentRevenue ?? 0) + (stats?.creditInstallmentIncome ?? 0))}</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Kredit Aylıq Ödəniş Statistikası ── */}
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

        {/* ── İcarə Bölməsi ── */}
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" /> İcarə Gəliri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            ) : (
              <>
                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100/60 flex items-center justify-center shrink-0">
                      <CircleDollarSign className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aylıq İcarə Gəliri</p>
                      <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(stats?.monthlyRentalIncome ?? 0)}</h3>
                      <p className="text-xs text-indigo-600 mt-0.5">{stats?.activeRentals ?? 0} aktiv müqavilə</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100/60 flex items-center justify-center shrink-0">
                      <Store className="w-7 h-7 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">İcarədə Olan Obyektlər</p>
                      <h3 className="text-2xl font-bold text-foreground mt-0.5">{stats?.rentedObjects ?? 0}</h3>
                      <p className="text-xs text-rose-600 mt-0.5">hal-hazırda icarədə</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-100/60 flex items-center justify-center shrink-0">
                      <Building2 className="w-7 h-7 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Boş Olan Obyektlər</p>
                      <h3 className="text-2xl font-bold text-foreground mt-0.5">{stats?.availableObjects ?? 0}</h3>
                      <p className="text-xs text-teal-600 mt-0.5">icarəyə hazır</p>
                    </div>
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
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={apartmentData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
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
            <CardContent className="space-y-4 mt-2">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : stats && (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" /> Müştərilər
                    </span>
                    <span className="font-bold text-lg">{stats.totalCustomers}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Home className="w-4 h-4" /> Satılmış Mənzil
                    </span>
                    <span className="font-bold text-lg text-emerald-600">{stats.soldApartments}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Tehvil Edilmiş
                    </span>
                    <span className="font-bold text-lg text-blue-600">{stats.handedOverApartments}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Store className="w-4 h-4" /> Obyekt/Qaraj
                    </span>
                    <span className="font-bold text-lg">{stats.totalObjects + stats.totalGarages}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Wifi className="w-4 h-4" /> İnternet Abunə
                    </span>
                    <span className="font-bold text-lg">{stats.activeInternetSubscriptions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4" /> Gözləyən Kommunal
                    </span>
                    <span className="font-bold text-lg text-amber-600">{stats.pendingCommunalBills}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
