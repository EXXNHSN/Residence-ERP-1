import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCustomer } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  Loader2, ArrowLeft, Phone, MapPin, Hash, Pencil,
  Home, Car, Store, ParkingCircle, Building2,
  ChevronDown, ChevronUp, ShoppingBag, CalendarDays,
  Key, Banknote, TrendingUp, MapPinned, FileText, Receipt,
  Ruler, CreditCard,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCustomerQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Badge config (same as list page) ─────────────────────────────────────────
const BADGE_CONFIG = [
  { key: "apartment",    icon: Home,          color: "text-blue-600",    bg: "bg-blue-50",       border: "border-blue-200",   label: "Mənzil sahibi",                gradientFrom: "from-blue-500",    gradientTo: "to-blue-400" },
  { key: "objectSale",   icon: Building2,     color: "text-emerald-600", bg: "bg-emerald-50",    border: "border-emerald-200",label: "Qeyri yaşayış satın alıb",     gradientFrom: "from-emerald-500", gradientTo: "to-emerald-400" },
  { key: "garageSale",   icon: Car,           color: "text-indigo-700",  bg: "bg-indigo-50",     border: "border-indigo-200", label: "Avto dayanacaq sahibi",        gradientFrom: "from-indigo-600",  gradientTo: "to-indigo-400" },
  { key: "garageRental", icon: ParkingCircle, color: "text-indigo-400",  bg: "bg-indigo-50/60",  border: "border-indigo-100", label: "Avto dayanacaq icarəçisi",     gradientFrom: "from-indigo-400",  gradientTo: "to-sky-300" },
  { key: "objectRental", icon: Store,         color: "text-amber-600",   bg: "bg-amber-50",      border: "border-amber-200",  label: "Qeyri yaşayış icarəçisi",      gradientFrom: "from-amber-500",   gradientTo: "to-orange-400" },
];

function RentalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Aktiv", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ended: { label: "Bitib", className: "bg-slate-100 text-slate-600 border-slate-200" },
    cancelled: { label: "Ləğv edilib", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.className}`}>{s.label}</Badge>;
}

// ── Collapsible section ───────────────────────────────────────────────────────
function CollapsibleSection({ icon: Icon, title, count, iconColor, children, defaultOpen = false }: {
  icon: any; title: string; count: number; iconColor: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-none shadow-lg shadow-black/5 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${open ? "bg-primary/10" : "bg-muted"} transition-colors`}>
            <Icon className={`w-4 h-4 ${open ? iconColor : "text-muted-foreground"}`} />
          </div>
          <span className="text-base font-semibold">{title}</span>
          <Badge variant="secondary" className="rounded-full text-xs px-2 py-0 h-5">{count}</Badge>
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${open ? "bg-primary/10" : "bg-muted"}`}>
          {open ? <ChevronUp className={`w-4 h-4 ${iconColor}`} /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="px-6 pb-6 pt-0 border-t border-border/40">{children}</div>}
    </Card>
  );
}

// ── Single sale card ──────────────────────────────────────────────────────────
function SaleCard({ sale }: { sale: any }) {
  const [showDate, setShowDate] = useState(false);
  const [showFinance, setShowFinance] = useState(false);

  const isApt = sale.assetType === "apartment";
  const vatAmount = isApt ? sale.totalAmount * 0.18 : 0;
  const vatRefund = isApt && sale.saleType === "cash" ? vatAmount * 0.30 : 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4">
        {/* Asset icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isApt ? "bg-blue-100" : "bg-indigo-100"
        }`}>
          {isApt
            ? <Home className="w-5 h-5 text-blue-600" />
            : <Car className="w-5 h-5 text-indigo-600" />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{sale.assetDescription}</span>
            <StatusBadge status={sale.saleType} />
          </div>

          {/* Location breadcrumb (apartment only) */}
          {isApt && (sale.quarterName || sale.buildingName || sale.blockName) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPinned className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {[sale.quarterName, sale.buildingName, sale.blockName].filter(Boolean).join(" › ")}
            </div>
          )}

          {/* Area + pricePerSqm chips */}
          <div className="flex flex-wrap gap-2">
            {sale.area > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-0.5">
                <Ruler className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{sale.area} m²</span>
              </div>
            )}
            {sale.pricePerSqm && (
              <div className="flex items-center gap-1 bg-blue-50 rounded-lg px-2 py-0.5">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-blue-700">{formatCurrency(sale.pricePerSqm)} / m²</span>
              </div>
            )}
          </div>

          {/* Contract number */}
          {sale.contractNumber && (
            <div className="flex items-center gap-1.5 bg-primary/5 rounded-lg px-2.5 py-1 w-fit">
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-mono font-semibold text-primary select-all">{sale.contractNumber}</span>
            </div>
          )}

          {/* Payment code */}
          {sale.paymentCode && (
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1 w-fit">
              <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs tracking-widest text-foreground select-all">{sale.paymentCode}</span>
            </div>
          )}
        </div>

        {/* Action icon buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setShowDate(d => !d); setShowFinance(false); }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                  showDate ? "bg-primary text-white border-primary" : "bg-muted border-transparent hover:border-primary/40 text-muted-foreground hover:text-primary"
                }`}>
                <CalendarDays className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Satış tarixi</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setShowFinance(f => !f); setShowDate(false); }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                  showFinance ? "bg-emerald-600 text-white border-emerald-600" : "bg-muted border-transparent hover:border-emerald-400 text-muted-foreground hover:text-emerald-600"
                }`}>
                <Banknote className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Maliyyə detalları</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Date panel */}
      {showDate && (
        <div className="border-t border-border/40 bg-muted/30 px-4 py-3 flex items-center gap-2 text-sm">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Satış tarixi:</span>
          <span className="font-semibold text-foreground">{format(new Date(sale.saleDate), 'dd MMMM yyyy')}</span>
        </div>
      )}

      {/* Finance panel */}
      {showFinance && (
        <div className="border-t border-border/40 bg-emerald-50/50 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3 border border-border/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ümumi</p>
              <p className="font-bold text-foreground text-sm">{formatCurrency(sale.totalAmount)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-emerald-200 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ödənilib</p>
              <p className="font-bold text-emerald-600 text-sm">{formatCurrency(sale.paidAmount)}</p>
              {sale.saleType === 'credit' && sale.downPayment > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">İlkin: {formatCurrency(sale.downPayment)}</p>
              )}
            </div>
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-center">
              <p className="text-xs text-muted-foreground mb-1">Borc</p>
              <p className={`font-bold text-sm ${sale.remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatCurrency(sale.remainingAmount)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-border/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">İrəliləyiş</p>
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <span className="text-xs font-bold text-primary">{sale.progressPercent ?? 0}%</span>
                <Progress value={sale.progressPercent ?? 0} className="h-1.5 w-full" />
              </div>
            </div>
          </div>

          {/* ƏDV section — apartments only */}
          {isApt && sale.totalAmount > 0 && (
            <div className="space-y-2 pt-2 border-t border-emerald-200/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">ƏDV Məlumatı</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200">
                  <p className="text-[10px] text-muted-foreground">Şirkət ƏDV (18%)</p>
                  <p className="font-bold text-amber-700 text-sm mt-0.5">{formatCurrency(vatAmount)}</p>
                </div>
                {vatRefund > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200">
                    <p className="text-[10px] text-muted-foreground">Dövlət ƏDV qaytarması (30%×18%)</p>
                    <p className="font-bold text-emerald-700 text-sm mt-0.5">{formatCurrency(vatRefund)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username, password: adminPassword,
        firstName: editFirstName, lastName: editLastName, phone: editPhone,
        fin: editFin?.trim().toUpperCase() || null, address: editAddress,
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: "Xəta" })); throw new Error(err.error ?? "Xəta baş verdi"); }
    toast({ title: "Sakin məlumatları yeniləndi" });
    qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(Number(id)) });
  }

  if (isLoading) return <AppLayout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  if (isError || !customer) return <AppLayout><div className="text-center text-destructive p-12">Sakin tapılmadı</div></AppLayout>;

  const rentals = (customer as any).rentals ?? [];
  const sales = customer.sales ?? [];

  const badges: Record<string, boolean> = {
    apartment: sales.some((s: any) => s.assetType === "apartment"),
    garageSale: sales.some((s: any) => s.assetType === "garage"),
    objectSale: sales.some((s: any) => s.assetType === "object"),
    garageRental: rentals.some((r: any) => r.assetType === "garage"),
    objectRental: rentals.some((r: any) => r.assetType === "object"),
  };
  const isResident = badges.apartment || badges.objectSale;
  const activeBadges = BADGE_CONFIG.filter(b => badges[b.key]);

  return (
    <TooltipProvider>
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/customers" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Sakin Profili</h1>
              <p className="text-muted-foreground mt-1">#{customer.id} — {customer.firstName} {customer.lastName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── Left: Profile card ── */}
            <div className="md:col-span-1 space-y-4">
              <Card className="border-none shadow-lg shadow-black/5">
                <CardContent className="p-6">
                  <div className="relative flex flex-col items-center text-center pb-5 mb-5 border-b border-border/50">
                    {isAdmin && (
                      <Button size="icon" variant="ghost"
                        className="absolute top-0 right-0 h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={openEdit}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${isResident ? "from-blue-500 to-blue-400" : "from-amber-500 to-orange-400"} flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg`}>
                      {customer.firstName[0]}{customer.lastName[0]}
                    </div>
                    <h2 className="text-xl font-bold leading-tight">{customer.firstName} {customer.lastName}</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </p>
                    <div className="mt-2">
                      {isResident ? (
                        <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 font-semibold px-3">Sakin</Badge>
                      ) : activeBadges.length > 0 ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 font-semibold px-3">İcarəçi</Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 text-muted-foreground px-3">Qeyd yoxdur</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">FIN Kod</p>
                        <p className="font-mono font-medium">{customer.fin || '—'}</p>
                      </div>
                    </div>
                    {customer.address && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ünvan</p>
                          <p className="font-medium">{customer.address}</p>
                        </div>
                      </div>
                    )}
                    {(customer as any).idCardType && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {(customer as any).idCardType === "yeni_nesil" ? "Yeni nəsil vəsiqə" :
                             (customer as any).idCardType === "kohne_nesil" ? "Köhnə nəsil vəsiqə" :
                             (customer as any).idCardType === "myi" ? "MYİ icazə" : "DYİ icazə"}
                          </p>
                          <p className="font-mono font-semibold tracking-wider">{(customer as any).idCardNumber || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
                    <div className="bg-muted/60 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{sales.length}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Satınalma</p>
                    </div>
                    <div className="bg-muted/60 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{rentals.length}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">İcarə</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status icon cards */}
              {activeBadges.length > 0 && (
                <Card className="border-none shadow-lg shadow-black/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Əlaqəli aktivlər</p>
                    <div className="space-y-2">
                      {activeBadges.map(b => {
                        const Icon = b.icon;
                        return (
                          <div key={b.key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${b.bg} ${b.border}`}>
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${b.gradientFrom} ${b.gradientTo} flex items-center justify-center shadow-sm shrink-0`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <span className={`text-sm font-medium ${b.color}`}>{b.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right: Sections ── */}
            <div className="md:col-span-2 space-y-4">

              {/* Satınalma Tarixçəsi — closed by default */}
              <CollapsibleSection
                icon={ShoppingBag} title="Satınalma Tarixçəsi"
                count={sales.length} iconColor="text-primary" defaultOpen={false}>
                {sales.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm mt-4">Bu sakinin satınalması yoxdur.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {sales.map((sale: any) => <SaleCard key={sale.id} sale={sale} />)}
                  </div>
                )}
              </CollapsibleSection>

              {/* İcarə Müqavilələri — closed by default */}
              <CollapsibleSection
                icon={CalendarDays} title="İcarə Müqavilələri"
                count={rentals.length} iconColor="text-blue-600" defaultOpen={false}>
                {rentals.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm mt-4">Bu sakinin icarə müqaviləsi yoxdur.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
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
                        {rentals.map((rental: any) => {
                          const cfg = rental.assetType === "garage"
                            ? { icon: ParkingCircle, color: "text-indigo-600", bg: "bg-indigo-50" }
                            : { icon: Store, color: "text-amber-600", bg: "bg-amber-50" };
                          const RIcon = cfg.icon;
                          return (
                            <TableRow key={rental.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                                    <RIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                  </div>
                                  <span className="font-medium text-sm">{rental.assetDescription}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{format(new Date(rental.startDate), 'dd.MM.yyyy')}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{format(new Date(rental.endDate), 'dd.MM.yyyy')}</TableCell>
                              <TableCell className="text-right font-bold text-blue-700 whitespace-nowrap">{formatCurrency(rental.monthlyAmount)}</TableCell>
                              <TableCell><RentalStatusBadge status={rental.status} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleSection>
            </div>
          </div>
        </div>

        {/* Edit dialog */}
        <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
          title="Sakini Redaktə et" onSave={handleSaveCustomer}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ad</label>
                <Input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Soyad</label>
                <Input value={editLastName} onChange={e => setEditLastName(e.target.value)} className="rounded-xl h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefon</label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="rounded-xl h-11" placeholder="+994..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">FIN Kod <span className="text-xs text-muted-foreground">(7 simvol)</span></label>
                <Input value={editFin} onChange={e => setEditFin(e.target.value.toUpperCase())}
                  className="rounded-xl h-11 font-mono" maxLength={7} placeholder="AX12345" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ünvan</label>
              <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
        </AdminEditDialog>
      </AppLayout>
    </TooltipProvider>
  );
}
