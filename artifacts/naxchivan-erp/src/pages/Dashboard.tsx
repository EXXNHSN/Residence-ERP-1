import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { 
  Building2, 
  Wallet, 
  AlertCircle, 
  TrendingUp, 
  Home, 
  Key, 
  Wifi, 
  CreditCard,
  Users,
  Store,
  Zap
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

  const statCards = [
    {
      title: "Ümumi Gəlir",
      value: stats ? formatCurrency(stats.totalRevenue) : "0",
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-100/50",
    },
    {
      title: "Bu Ayın Gözlənilən Ödənişi",
      value: stats ? formatCurrency(stats.monthlyPendingAmount) : "0",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-100/50",
    },
    {
      title: "Aktiv Kirayələr",
      value: stats?.activeRentals || 0,
      icon: Key,
      color: "text-indigo-600",
      bg: "bg-indigo-100/50",
    },
    {
      title: "Gecikmiş Ödənişlər",
      value: stats?.overdueInstallments || 0,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-100/50",
    },
  ];

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            statCards.map((card, i) => (
              <Card key={i} className="border-none shadow-lg shadow-black/5 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`w-7 h-7 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{card.value}</h3>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

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
                Ümumi Məlumat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 mt-2">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : stats && (
                <>
                  <div className="flex justify-between items-center pb-4 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Users className="w-4 h-4" /> Müştərilər
                    </span>
                    <span className="font-bold text-lg">{stats.totalCustomers}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Store className="w-4 h-4" /> Obyekt/Qaraj
                    </span>
                    <span className="font-bold text-lg">{stats.totalObjects + stats.totalGarages}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Wifi className="w-4 h-4" /> İnternet Abunə
                    </span>
                    <span className="font-bold text-lg">{stats.activeInternetSubscriptions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
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
