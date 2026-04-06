import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListSales } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import {
  Plus, Loader2, Pencil, CreditCard, Home, Store, Car,
  ChevronDown, ChevronUp, TrendingUp, Search, ReceiptText,
  Wallet, AlertCircle, Trash2
} from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Section config ──────────────────────────────────────────
const SECTIONS = [
  {
    key: "apartment",
    label: "Satılan Mənzillər",
    description: "Yaşayış mənzilləri üzrə satışlar",
    icon: Home,
    color: "text-primary",
    bgLight: "bg-primary/5",
    bgHover: "hover:bg-primary/10",
    borderActive: "border-primary/30",
    badgeBg: "bg-primary/10 text-primary",
    iconWrap: "bg-primary/10",
  },
  {
    key: "object",
    label: "Qeyri Yaşayış Sahələri",
    description: "Kommersiya, ofis və digər qeyri yaşayış sahələrinin satışları",
    icon: Store,
    color: "text-amber-600",
    bgLight: "bg-amber-50",
    bgHover: "hover:bg-amber-50",
    borderActive: "border-amber-200",
    badgeBg: "bg-amber-100 text-amber-700",
    iconWrap: "bg-amber-100",
  },
  {
    key: "garage",
    label: "Avto Dayanacaq (Qarajlar)",
    description: "Qaraj və avto dayanacaq satışları",
    icon: Car,
    color: "text-violet-600",
    bgLight: "bg-violet-50",
    bgHover: "hover:bg-violet-50",
    borderActive: "border-violet-200",
    badgeBg: "bg-violet-100 text-violet-700",
    iconWrap: "bg-violet-100",
  },
] as const;

// ── SaleRow ──────────────────────────────────────────────────
function SaleRow({
  sale, isAdmin, onEdit, onDelete,
}: { sale: any; isAdmin: boolean; onEdit: (s: any) => void; onDelete: (s: any) => void }) {
  return (
    <TableRow className="hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0 group">
      <TableCell className="pl-5 text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(sale.saleDate), "dd.MM.yyyy")}
      </TableCell>
      <TableCell>
        <Link href={`/customers/${sale.customerId}`}
          className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
          {sale.customerName}
        </Link>
        {sale.customerPhone && (
          <p className="text-xs text-muted-foreground mt-0.5">{sale.customerPhone}</p>
        )}
      </TableCell>
      <TableCell className="font-medium text-sm text-foreground">
        {sale.assetDescription}
      </TableCell>
      <TableCell><StatusBadge status={sale.saleType} /></TableCell>
      <TableCell className="text-right">
        <span className="font-bold text-sm">{formatCurrency(sale.totalAmount)}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-semibold text-sm text-emerald-600">{formatCurrency(sale.paidAmount)}</span>
        {sale.saleType === "credit" && sale.downPayment > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">İlkin: {formatCurrency(sale.downPayment)}</p>
        )}
      </TableCell>
      <TableCell className="text-right">
        <span className={`font-semibold text-sm ${sale.remainingAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
          {formatCurrency(sale.remainingAmount)}
        </span>
        {sale.saleType === "credit" && sale.monthlyPayment > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(sale.monthlyPayment)}/ay</p>
        )}
      </TableCell>
      <TableCell className="min-w-[110px]">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">{Math.round(sale.progressPercent)}%</span>
            {sale.remainingAmount > 0 && sale.installmentMonths > 0 && (
              <span className="text-muted-foreground">{sale.installmentMonths} ay</span>
            )}
          </div>
          <Progress value={sale.progressPercent} className="h-1.5 bg-slate-100" />
        </div>
      </TableCell>
      {isAdmin && (
        <TableCell className="pr-4">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <Button size="icon" variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(sale)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(sale)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

// ── SectionPanel ─────────────────────────────────────────────
function SectionPanel({
  section, sales, isAdmin, onEdit, onDelete, isOpen, onToggle,
}: {
  section: typeof SECTIONS[number];
  sales: any[];
  isAdmin: boolean;
  onEdit: (s: any) => void;
  onDelete: (s: any) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  const totalRevenue = sales.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
  const totalPaid = sales.reduce((s, x) => s + (x.paidAmount ?? 0), 0);
  const creditCount = sales.filter(x => x.saleType === "credit").length;
  const remaining = sales.reduce((s, x) => s + (x.remainingAmount ?? 0), 0);

  return (
    <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
      isOpen ? `border-border/70 shadow-md ${section.borderActive}` : "border-border/40"
    }`}>
      {/* ── Section header ── */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 p-5 text-left transition-colors ${
          isOpen ? section.bgLight : `bg-card ${section.bgHover}`
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${section.iconWrap}`}>
          <Icon className={`w-5 h-5 ${section.color}`} />
        </div>

        {/* Title + desc */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-display font-bold text-base text-foreground">{section.label}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${section.badgeBg}`}>
              {sales.length} satış
            </span>
            {creditCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <CreditCard className="w-3 h-3" /> {creditCount} kredit
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
        </div>

        {/* Stats (desktop) */}
        {sales.length > 0 && (
          <div className="hidden md:flex items-center gap-6 text-right flex-shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Cəmi dəyər</p>
              <p className="font-bold text-sm text-foreground">{formatCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Ödənilib</p>
              <p className="font-bold text-sm text-emerald-600">{formatCurrency(totalPaid)}</p>
            </div>
            {remaining > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Borc</p>
                <p className="font-bold text-sm text-amber-600">{formatCurrency(remaining)}</p>
              </div>
            )}
          </div>
        )}

        {/* Toggle chevron */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          isOpen ? `${section.badgeBg}` : "bg-muted/60"
        }`}>
          {isOpen
            ? <ChevronUp className={`w-4 h-4 ${section.color}`} />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* ── Expanded content ── */}
      {isOpen && (
        <div className="border-t border-border/50">
          {sales.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${section.iconWrap}`}>
                <Icon className={`w-6 h-6 ${section.color} opacity-40`} />
              </div>
              <p className="font-medium text-foreground">Bu kateqoriyada satış yoxdur</p>
              <Link href="/sales/create">
                <Button size="sm" variant="outline" className="mt-3 rounded-xl gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Satış yarat
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile stats row */}
              <div className="md:hidden flex gap-3 p-4 bg-muted/30 border-b border-border/40">
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-muted-foreground">Cəmi dəyər</p>
                  <p className="font-bold text-sm">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="flex-1 text-center border-x border-border/40">
                  <p className="text-[10px] text-muted-foreground">Ödənilib</p>
                  <p className="font-bold text-sm text-emerald-600">{formatCurrency(totalPaid)}</p>
                </div>
                {remaining > 0 && (
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-muted-foreground">Borc</p>
                    <p className="font-bold text-sm text-amber-600">{formatCurrency(remaining)}</p>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">Tarix</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Sakin</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Aktivin Adı</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Növ</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Ümumi</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Ödənilib</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Qalıq Borc</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground min-w-[110px]">İrəliləyiş</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(sale => (
                    <SaleRow key={sale.id} sale={sale} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SalesPage() {
  const { data: sales, isLoading } = useListSales();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["apartment"]));

  const [editOpen, setEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDown, setEditDown] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editDate, setEditDate] = useState("");

  const [deleteSale, setDeleteSale] = useState<any>(null);

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function openEdit(sale: any) {
    setEditingSale(sale);
    setEditPrice(sale.pricePerSqm?.toString() ?? "");
    setEditDown(sale.downPayment?.toString() ?? "0");
    setEditMonths(sale.installmentMonths?.toString() ?? "12");
    setEditDate(format(new Date(sale.saleDate), "yyyy-MM-dd"));
    setEditOpen(true);
  }

  async function handleDeleteSale(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/sales/${deleteSale.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Silmə zamanı xəta baş verdi");
    }
    toast({ title: "Satış silindi, aktiv boşa çıxarıldı" });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["apartments"] });
    qc.invalidateQueries({ queryKey: ["/api/stats/summary"] });
    setDeleteSale(null);
  }

  async function handleSaveSale(adminPassword: string) {
    const body: any = {
      username: user?.username,
      password: adminPassword,
      pricePerSqm: Number(editPrice),
      saleDate: editDate,
    };
    if (editingSale?.saleType === "credit") {
      body.downPayment = Number(editDown);
      body.installmentMonths = Number(editMonths);
    }
    const res = await fetch(`${BASE()}/api/sales/${editingSale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: "Satış məlumatları yeniləndi" });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  // Filter + split by type
  const grouped = useMemo(() => {
    if (!sales) return { apartment: [], object: [], garage: [] };
    const q = search.trim().toLowerCase();
    const filtered = q
      ? sales.filter((s: any) =>
          s.customerName?.toLowerCase().includes(q) ||
          s.assetDescription?.toLowerCase().includes(q) ||
          s.customerPhone?.includes(q)
        )
      : sales;
    return {
      apartment: filtered.filter((s: any) => s.assetType === "apartment"),
      object: filtered.filter((s: any) => s.assetType === "object"),
      garage: filtered.filter((s: any) => s.assetType === "garage"),
    };
  }, [sales, search]);

  const totals = useMemo(() => {
    if (!sales) return { count: 0, revenue: 0, paid: 0, remaining: 0, credit: 0 };
    return {
      count: sales.length,
      revenue: sales.reduce((s: number, x: any) => s + (x.totalAmount ?? 0), 0),
      paid: sales.reduce((s: number, x: any) => s + (x.paidAmount ?? 0), 0),
      remaining: sales.reduce((s: number, x: any) => s + (x.remainingAmount ?? 0), 0),
      credit: sales.filter((x: any) => x.saleType === "credit").length,
    };
  }, [sales]);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Satışlar</h1>
            <p className="text-muted-foreground mt-1">Mənzil, qeyri yaşayış və avto dayanacaq satışları</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/sales/credits"
              className="inline-flex items-center gap-2 h-10 rounded-xl px-4 border border-border/60 bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors shadow-sm">
              <CreditCard className="w-4 h-4 text-blue-600" /> Kredit Hesabat
            </Link>
            <Link href="/sales/create"
              className="inline-flex items-center gap-2 h-10 rounded-xl px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 transition-colors">
              <Plus className="w-4 h-4" /> Yeni Satış
            </Link>
          </div>
        </div>

        {/* ── Overall stats ── */}
        {!isLoading && sales && sales.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Cəmi Satış", value: totals.count, display: String(totals.count), icon: ReceiptText, color: "text-foreground", bg: "bg-card" },
              { label: "Ümumi Dəyər", value: totals.revenue, display: formatCurrency(totals.revenue), icon: TrendingUp, color: "text-primary", bg: "bg-primary/5" },
              { label: "Yığılmış", value: totals.paid, display: formatCurrency(totals.paid), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Qalıq Borc", value: totals.remaining, display: formatCurrency(totals.remaining), icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-border/50 p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <Icon className={`w-4 h-4 ${s.color} opacity-70`} />
                  </div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.display}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Search ── */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (e.target.value) setOpenSections(new Set(["apartment", "object", "garage"]));
              }}
              placeholder="Sakin adı, aktiv, telefon..."
              className="pl-9 rounded-xl h-10 bg-card border-border/60"
            />
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-xl"
            onClick={() => setOpenSections(new Set(["apartment", "object", "garage"]))}>
            Hamısını aç
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-xl"
            onClick={() => setOpenSections(new Set())}>
            Hamısını bağla
          </Button>
        </div>

        {/* ── Section panels ── */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map(section => (
              <SectionPanel
                key={section.key}
                section={section}
                sales={grouped[section.key as keyof typeof grouped]}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={setDeleteSale}
                isOpen={openSections.has(section.key)}
                onToggle={() => toggleSection(section.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete Dialog ── */}
      <AdminEditDialog
        open={!!deleteSale}
        onClose={() => setDeleteSale(null)}
        title="Satışı Sil"
        saveLabel="Sil"
        saveVariant="destructive"
        onSave={handleDeleteSale}
      >
        {deleteSale && (
          <div className="space-y-3">
            <div className="rounded-xl bg-red-50 border border-destructive/20 p-4 text-sm text-destructive space-y-1">
              <p className="font-semibold">Bu əməliyyat geri qaytarıla bilməz!</p>
              <p>Aşağıdakı satış silinəcək və aktiv yenidən boş vəziyyətə keçəcək:</p>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sakin:</span>
                <span className="font-semibold">{deleteSale.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktiv:</span>
                <span className="font-medium">{deleteSale.assetDescription}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Satış növü:</span>
                <StatusBadge status={deleteSale.saleType} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cəmi məbləğ:</span>
                <span className="font-bold text-foreground">{formatCurrency(deleteSale.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </AdminEditDialog>

      {/* ── Edit Dialog ── */}
      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Satışı Redaktə et" onSave={handleSaveSale}>
        {editingSale && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 flex-shrink-0" />
              {editingSale.customerName} — {editingSale.assetDescription}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">1 m² Qiyməti (AZN)</label>
                <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tarix</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
            </div>
            {editingSale.saleType === "credit" && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">İlkin Ödəniş (AZN)</label>
                  <Input type="number" value={editDown} onChange={e => setEditDown(e.target.value)}
                    className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Müddət (Ay)</label>
                  <Input type="number" value={editMonths} onChange={e => setEditMonths(e.target.value)}
                    className="rounded-xl h-11" />
                </div>
              </div>
            )}
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
