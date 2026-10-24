import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, RotateCcw, Percent, Search, PlusCircle, Zap, Building2, User, AlertTriangle } from "lucide-react";
import { formatCurrency, formatArea } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

const MONTHS = [
  { value: 1, label: "Yanvar" },
  { value: 2, label: "Fevral" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Aprel" },
  { value: 5, label: "May" },
  { value: 6, label: "İyun" },
  { value: 7, label: "İyul" },
  { value: 8, label: "Avqust" },
  { value: 9, label: "Sentyabr" },
  { value: 10, label: "Oktyabr" },
  { value: 11, label: "Noyabr" },
  { value: 12, label: "Dekabr" },
];

export default function CommunalPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssetType, setFilterAssetType] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Dialogs
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(String(currentMonth));
  const [genYear, setGenYear] = useState(String(currentYear));
  const [generating, setGenerating] = useState(false);

  // Admin Tariff Discount Dialog
  const [selectedBillForTariff, setSelectedBillForTariff] = useState<any | null>(null);
  const [customTariffInput, setCustomTariffInput] = useState("");

  // Fetch Bills
  const { data: bills = [], isLoading } = useQuery<any[]>({
    queryKey: ["communal-bills", filterMonth, filterYear, filterStatus, filterAssetType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterMonth !== "all") params.append("month", filterMonth);
      if (filterYear !== "all") params.append("year", filterYear);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterAssetType !== "all") params.append("assetType", filterAssetType);

      const res = await fetch(`${BASE()}/api/communal?${params.toString()}`);
      if (!res.ok) throw new Error("Məlumatları yükləmək mümkün olmadı");
      return res.json();
    },
  });

  // Filtered Bills by search
  const filteredBills = useMemo(() => {
    if (!search.trim()) return bills;
    const q = search.toLowerCase();
    return bills.filter((b) =>
      (b.assetDescription && b.assetDescription.toLowerCase().includes(q)) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(q)) ||
      (b.blockName && b.blockName.toLowerCase().includes(q))
    );
  }, [bills, search]);

  // Summary statistics
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    let totalCarryOver = 0;

    filteredBills.forEach((b) => {
      const amt = Number(b.totalAmount || b.amount);
      if (b.status === "paid") {
        totalPaid += amt;
      } else {
        totalPending += amt;
      }
      totalCarryOver += Number(b.carryOver || 0);
    });

    return {
      count: filteredBills.length,
      paid: Math.round(totalPaid * 100) / 100,
      pending: Math.round(totalPending * 100) / 100,
      carryOver: Math.round(totalCarryOver * 100) / 100,
    };
  }, [filteredBills]);

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE()}/api/communal/${id}/pay`, { method: "POST" });
      if (!res.ok) throw new Error("Ödəniş edilə bilmədi");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communal-bills"] });
      toast({ title: "Ödəniş qəbul edildi", description: "Kommunal borc bağlandı." });
    },
    onError: (err: any) => {
      toast({ title: "Xəta", description: err.message, variant: "destructive" });
    },
  });

  // Unpay mutation
  const unpayMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE()}/api/communal/${id}/unpay`, { method: "POST" });
      if (!res.ok) throw new Error("Əməliyyat ləğv edilə bilmədi");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communal-bills"] });
      toast({ title: "Status dəyişdirildi", description: "Ödəniş ləğv edildi." });
    },
  });

  // Generate monthly bills handler
  async function handleGenerateBills() {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE()}/api/communal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: Number(genMonth),
          year: Number(genYear),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Hesablar yaradılarkən xəta baş verdi");
      }
      toast({
        title: "Uğurlu",
        description: `${data.count || 0} ədəd kommunal hesab yaradıldı (təhvil edilmiş mənzillər və obyektlər).`,
      });
      setIsGenerateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["communal-bills"] });
    } catch (err: any) {
      toast({ title: "Xəta", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  // Open Admin Tariff Discount
  function openTariffDialog(bill: any) {
    setSelectedBillForTariff(bill);
    setCustomTariffInput(bill.customTariff ? String(bill.customTariff) : String(bill.tariff));
  }

  // Save Admin Tariff Discount
  async function handleSaveTariff(adminPassword: string) {
    if (!selectedBillForTariff) return;
    const res = await fetch(`${BASE()}/api/communal/${selectedBillForTariff.id}/tariff`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username,
        password: adminPassword,
        customTariff: customTariffInput ? Number(customTariffInput) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Tarif dəyişdirilə bilmədi");
    }
    toast({
      title: "Tarif yeniləndi",
      description: `Mənzil üçün yeni tarif və borc yenidən hesablandı.`,
    });
    queryClient.invalidateQueries({ queryKey: ["communal-bills"] });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
              <Zap className="w-7 h-7 text-amber-500" /> Kommunal Xidmətlər
            </h1>
            <p className="text-muted-foreground mt-1">
              Təhvil verilmiş mənzillər və obyektlər üzrə aylıq kommunal hesablamalar və borclar
            </p>
          </div>
          <Button
            onClick={() => setIsGenerateOpen(true)}
            className="rounded-xl px-5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Aylıq Hesablar Yarat
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">Cəmi Hesablar</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.count}</p>
          </div>
          <div className="bg-emerald-50/70 border-emerald-200 rounded-2xl border p-4 shadow-sm">
            <p className="text-xs text-emerald-800 font-medium">Ödənilmiş Məbləğ</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(stats.paid)}</p>
          </div>
          <div className="bg-rose-50/70 border-rose-200 rounded-2xl border p-4 shadow-sm">
            <p className="text-xs text-rose-800 font-medium">Gözləyən Borc</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{formatCurrency(stats.pending)}</p>
          </div>
          <div className="bg-amber-50/70 border-amber-200 rounded-2xl border p-4 shadow-sm">
            <p className="text-xs text-amber-800 font-medium">Yığılmış Keçmiş Borc</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(stats.carryOver)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-2xl border border-border/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mənzil, blok, mülkiyyətçi axtar..."
              className="pl-9 rounded-xl h-10 bg-background"
            />
          </div>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px] rounded-xl h-10 bg-background">
              <SelectValue placeholder="Ay" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Aylar</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[110px] rounded-xl h-10 bg-background">
              <SelectValue placeholder="İl" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün İllər</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] rounded-xl h-10 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Statuslar</SelectItem>
              <SelectItem value="pending">Ödənilməyib</SelectItem>
              <SelectItem value="paid">Ödənilib</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAssetType} onValueChange={setFilterAssetType}>
            <SelectTrigger className="w-[140px] rounded-xl h-10 bg-background">
              <SelectValue placeholder="Növ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün Növlər</SelectItem>
              <SelectItem value="apartment">Mənzillər</SelectItem>
              <SelectItem value="object">Obyektlər</SelectItem>
              <SelectItem value="garage">Qarajlar</SelectItem>
            </SelectContent>
          </Select>

          {(filterMonth !== "all" || filterYear !== String(currentYear) || filterStatus !== "all" || filterAssetType !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterMonth("all");
                setFilterYear("all");
                setFilterStatus("all");
                setFilterAssetType("all");
                setSearch("");
              }}
              className="text-primary text-xs"
            >
              Filtrləri sıfırla
            </Button>
          )}
        </div>

        {/* Bills Table */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Dövr</TableHead>
                    <TableHead>Mülkiyyətçi</TableHead>
                    <TableHead>Aktiv / Mənzil</TableHead>
                    <TableHead className="text-right">Sahə</TableHead>
                    <TableHead className="text-right">Tarif (m²)</TableHead>
                    <TableHead className="text-right">Cari Ay</TableHead>
                    <TableHead className="text-right">Keçmiş Borc</TableHead>
                    <TableHead className="text-right font-bold">Yekun Borc</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Əməliyyat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        Kommunal hesab tapılmadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBills.map((bill) => {
                      const monthName = MONTHS.find((m) => m.value === bill.month)?.label ?? bill.month;
                      const hasCarryOver = Number(bill.carryOver) > 0;
                      const isDiscounted = bill.customTariff != null && Number(bill.customTariff) !== Number(bill.tariff);

                      return (
                        <TableRow key={bill.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-foreground whitespace-nowrap">
                            {monthName} {bill.year}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {bill.ownerName ? (
                              <span className="font-medium text-foreground">{bill.ownerName}</span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">Mülkiyyətçi yoxdur</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {bill.assetDescription}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                            {bill.area > 0 ? formatArea(bill.area) : "-"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className={isDiscounted ? "text-emerald-600 font-bold" : "text-foreground"}>
                                {isDiscounted ? `${bill.customTariff} ₼` : `${bill.tariff} ₼`}
                              </span>
                              {isDiscounted && (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 mt-0.5">
                                  Güzəştli
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatCurrency(bill.amount)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {hasCarryOver ? (
                              <span className="text-rose-600 font-semibold flex items-center justify-end gap-1">
                                <AlertTriangle className="w-3 h-3" /> +{formatCurrency(bill.carryOver)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">0.00 ₼</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className="font-bold text-base text-foreground">
                              {formatCurrency(bill.totalAmount)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <StatusBadge status={bill.status} type="payment" />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Yalnız administrator üçün: Tarif/Güzəşt dəyişdirmə */}
                              {isAdmin && bill.assetType === "apartment" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-lg gap-1 border-dashed text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
                                  onClick={() => openTariffDialog(bill)}
                                  title="Mənzil üçün xüsusi güzəştli tarif təyin edin"
                                >
                                  <Percent className="w-3.5 h-3.5" /> Güzəşt
                                </Button>
                              )}

                              {bill.status !== "paid" ? (
                                <Button
                                  size="sm"
                                  className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs px-3"
                                  onClick={() => payMutation.mutate(bill.id)}
                                  disabled={payMutation.isPending}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ödə
                                </Button>
                              ) : (
                                isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive"
                                    onClick={() => unpayMutation.mutate(bill.id)}
                                    title="Ödənişi ləğv et"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Generate Monthly Bills Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Aylıq Kommunal Hesablar Yarat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Seçilmiş ay və il üçün təhvil verilmiş bütün satılmış mənzillər və obyektlər üzrə kommunal hesablar hesablanacaq. Əgər əvvəlki aylardan ödənilməmiş borc varsa, avtomatik olaraq cari hesabın üzərinə əlavə olunacaq.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ay</Label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>İl</Label>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsGenerateOpen(false)} className="rounded-xl">
              Bağla
            </Button>
            <Button onClick={handleGenerateBills} disabled={generating} className="rounded-xl">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Hesabları Yarat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Custom Tariff Discount Dialog */}
      <AdminEditDialog
        open={Boolean(selectedBillForTariff)}
        onClose={() => setSelectedBillForTariff(null)}
        title="Kommunal Tarif Güzəşti"
        onSave={handleSaveTariff}
        saveLabel="Tarifi Yenilə"
      >
        {selectedBillForTariff && (
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Mənzil:</span>
                <span className="font-semibold text-foreground">{selectedBillForTariff.assetDescription}</span>
              </div>
              <div className="flex justify-between">
                <span>Sahə:</span>
                <span className="font-semibold text-foreground">{formatArea(selectedBillForTariff.area)}</span>
              </div>
              <div className="flex justify-between">
                <span>Standart Tarif:</span>
                <span className="font-semibold text-foreground">{selectedBillForTariff.tariff} AZN/m²</span>
              </div>
              {Number(selectedBillForTariff.carryOver) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Keçmiş Borc:</span>
                  <span className="font-semibold">{formatCurrency(selectedBillForTariff.carryOver)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Bu mənzil üçün xüsusi tarif (AZN / m²):</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Standart: ${selectedBillForTariff.tariff}`}
                value={customTariffInput}
                onChange={(e) => setCustomTariffInput(e.target.value)}
                className="rounded-xl h-11"
              />
              <p className="text-xs text-muted-foreground">
                Məsələn, 0.40 daxil etsəniz, bu mənzil üçün kommunal haqqı {selectedBillForTariff.area} × 0.40 = {(Number(selectedBillForTariff.area) * 0.4).toFixed(2)} AZN olacaq.
              </p>
            </div>

            {customTariffInput && !isNaN(Number(customTariffInput)) && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-emerald-800">
                  <span>Yenidən hesablanan cari ay:</span>
                  <span className="font-bold">{(Number(selectedBillForTariff.area) * Number(customTariffInput)).toFixed(2)} ₼</span>
                </div>
                <div className="flex justify-between text-emerald-950 font-bold border-t border-emerald-200/60 pt-1">
                  <span>Yeni Yekun Borc:</span>
                  <span>{((Number(selectedBillForTariff.area) * Number(customTariffInput)) + Number(selectedBillForTariff.carryOver || 0)).toFixed(2)} ₼</span>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
