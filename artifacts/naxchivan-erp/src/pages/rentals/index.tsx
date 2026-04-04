import { useState, Fragment, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListRentals, useListObjects, useListCustomers, ObjectStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Loader2, User, Phone, FileText, ChevronDown, ChevronUp, CheckCircle2, Clock, Car, Store, Search, MoreVertical, Trash2, AlertTriangle, MapPin, Building2, ShieldCheck, Info } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Helpers ───────────────────────────────────────────────────────────────

function RentalTable({ rentals, isAdmin, user, BASE, onLoadPayments, expandedId, loadingPayments, rentalPayments, togglePayment, onTerminate, onDelete }: any) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead>İcarədar</TableHead>
            <TableHead>Müqavilə №</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead>Müddət</TableHead>
            <TableHead className="text-right">Aylıq</TableHead>
            <TableHead>Ödənişlər</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[110px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rentals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
            </TableRow>
          ) : rentals.map((rental: any) => (
            <Fragment key={rental.id}>
              <TableRow className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {rental.tenantName || rental.customerName || "—"}
                    </div>
                    {rental.tenantPhone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {rental.tenantPhone}
                      </div>
                    )}
                    {rental.customerId && (
                      <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Sakin bağlı
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {rental.contractNumber ? (
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" /> {rental.contractNumber}
                    </div>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium">
                    {rental.assetType === "garage"
                      ? <Car className="w-3.5 h-3.5 text-indigo-500" />
                      : <Store className="w-3.5 h-3.5 text-amber-500" />}
                    {rental.assetDescription}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{format(new Date(rental.startDate), 'dd.MM.yyyy')}</div>
                  <div className="text-muted-foreground">— {format(new Date(rental.endDate), 'dd.MM.yyyy')}</div>
                  {rental.status === "active" && (
                    <div className={`text-xs font-medium mt-0.5 ${rental.daysRemaining < 30 ? "text-rose-500" : "text-muted-foreground"}`}>
                      {rental.daysRemaining} gün qalıb
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(rental.monthlyAmount)}</TableCell>
                <TableCell>
                  {rental.totalPayments > 0 ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {rental.paidCount}
                      </span>
                      <span className="text-muted-foreground">/ {rental.totalPayments}</span>
                    </div>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell><StatusBadge status={rental.status} type="rental" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => onLoadPayments(rental.id)}>
                      {loadingPayments[rental.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                        expandedId === rental.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span className="ml-1">Ödənişlər</span>
                    </Button>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          {rental.status === "active" && (
                            <DropdownMenuItem className="text-amber-600 focus:text-amber-600 gap-2"
                              onClick={() => onTerminate(rental)}>
                              <AlertTriangle className="w-4 h-4" /> Dayandır
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive gap-2"
                            onClick={() => onDelete(rental)}>
                            <Trash2 className="w-4 h-4" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === rental.id && rentalPayments[rental.id] && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={8} className="py-3 px-4">
                    <PaymentGrid payments={rentalPayments[rental.id]} rentalId={rental.id} onToggle={togglePayment} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentGrid({ payments, rentalId, onToggle }: { payments: any[]; rentalId: number; onToggle: (id: number, p: any) => void }) {
  const MONTHS = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {payments.map((p: any) => {
        const d = new Date(p.dueDate);
        const isPaid = p.status === "paid";
        return (
          <button key={p.id} type="button" onClick={() => onToggle(rentalId, p)}
            className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all w-14 ${isPaid ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
            {isPaid ? <CheckCircle2 className="w-3 h-3 mb-0.5" /> : <Clock className="w-3 h-3 mb-0.5" />}
            {MONTHS[d.getMonth()]}
            <span className="text-[10px] opacity-70">{d.getFullYear()}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RentalsPage() {
  const { data: rentals, isLoading, refetch } = useListRentals();
  const { data: allObjects } = useListObjects({ status: ObjectStatus.available });
  const { data: customers } = useListCustomers();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<"garage" | "object">("garage");
  const [garageDialogOpen, setGarageDialogOpen] = useState(false);
  const [objectDialogOpen, setObjectDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rentalPayments, setRentalPayments] = useState<Record<number, any[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<number, boolean>>({});

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionRental, setActionRental] = useState<any>(null);

  // ── Garage dialog state ──
  const [garageCustomerSearch, setGarageCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerBuilding, setCustomerBuilding] = useState<any>(null);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [crossBuildingAllowed, setCrossBuildingAllowed] = useState(false);
  const [crossBuildingOpen, setCrossBuildingOpen] = useState(false);
  const [selectedGarageId, setSelectedGarageId] = useState<string>("");
  const [garageContractNumber, setGarageContractNumber] = useState("");
  const [garageStartDate, setGarageStartDate] = useState("");
  const [garageEndDate, setGarageEndDate] = useState("");
  const [garageMonthlyAmount, setGarageMonthlyAmount] = useState("");

  // ── Object dialog state ──
  const [objTenantType, setObjTenantType] = useState<"resident" | "external">("external");
  const [objCustomerSearch, setObjCustomerSearch] = useState("");
  const [objCustomerId, setObjCustomerId] = useState<string>("");
  const [objTenantName, setObjTenantName] = useState("");
  const [objTenantPhone, setObjTenantPhone] = useState("");
  const [objTenantFin, setObjTenantFin] = useState("");
  const [objAssetId, setObjAssetId] = useState<string>("");
  const [objContractNumber, setObjContractNumber] = useState("");
  const [objPricePerSqm, setObjPricePerSqm] = useState("");
  const [objMonthlyAmount, setObjMonthlyAmount] = useState("");
  const [objStartDate, setObjStartDate] = useState("");
  const [objEndDate, setObjEndDate] = useState("");

  // ── Derived data ──
  const garages = allObjects?.filter((o: any) => o.type === "garage") ?? [];
  const objectAssets = allObjects?.filter((o: any) => o.type === "object") ?? [];
  const garageRentals = rentals?.filter((r: any) => r.assetType === "garage") ?? [];
  const objectRentals = rentals?.filter((r: any) => r.assetType === "object") ?? [];

  const selectedGarage = garages.find((g: any) => g.id.toString() === selectedGarageId);
  const selectedObjectAsset = objectAssets.find((o: any) => o.id.toString() === objAssetId);

  const filteredGarageCustomers = customers?.filter((c: any) =>
    `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(garageCustomerSearch.toLowerCase())
  ) ?? [];

  const filteredObjCustomers = customers?.filter((c: any) =>
    `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(objCustomerSearch.toLowerCase())
  ) ?? [];

  // ── Garage: group spots by building ──
  const sameBuildingGarages = customerBuilding?.buildingId
    ? garages.filter((g: any) => g.buildingId === customerBuilding.buildingId)
    : [];
  const otherBuildingGarages = customerBuilding?.buildingId
    ? garages.filter((g: any) => g.buildingId !== customerBuilding.buildingId)
    : garages;

  const garageListToShow = crossBuildingAllowed
    ? garages
    : (selectedCustomerId && customerBuilding?.buildingId ? sameBuildingGarages : garages);

  // ── Fetch customer building when customer selected ──
  useEffect(() => {
    if (!selectedCustomerId) { setCustomerBuilding(null); return; }
    setLoadingBuilding(true);
    fetch(`${BASE()}/api/customers/${selectedCustomerId}/building`)
      .then(r => r.json())
      .then(data => setCustomerBuilding(data))
      .catch(() => setCustomerBuilding(null))
      .finally(() => setLoadingBuilding(false));
  }, [selectedCustomerId]);

  // Auto-fill tenant info when customer selected in garage dialog
  useEffect(() => {
    if (!selectedCustomerId || !customers) return;
    const c = customers.find((c: any) => c.id.toString() === selectedCustomerId);
    if (!c) return;
  }, [selectedCustomerId, customers]);

  // Auto-fill monthly amount when garage selected
  useEffect(() => {
    if (selectedGarage) {
      setGarageMonthlyAmount(String(selectedGarage.monthlyRent ?? 100));
    }
  }, [selectedGarageId]);

  // Auto-fill object tenant when resident selected
  useEffect(() => {
    if (objTenantType === "resident" && objCustomerId && customers) {
      const c = customers.find((c: any) => c.id.toString() === objCustomerId);
      if (c) {
        setObjTenantName(`${c.firstName} ${c.lastName}`);
        setObjTenantPhone(c.phone ?? "");
        setObjTenantFin(c.fin ?? "");
      }
    }
  }, [objCustomerId, objTenantType, customers]);

  // Auto-calc object monthly amount
  const calcObjMonthly = () => {
    if (selectedObjectAsset && objPricePerSqm) {
      return (Number(selectedObjectAsset.area) * Number(objPricePerSqm)).toFixed(2);
    }
    return "";
  };

  function resetGarageDialog() {
    setGarageCustomerSearch(""); setSelectedCustomerId(""); setCustomerBuilding(null);
    setCrossBuildingAllowed(false); setSelectedGarageId(""); setGarageContractNumber("");
    setGarageStartDate(""); setGarageEndDate(""); setGarageMonthlyAmount("");
  }

  function resetObjectDialog() {
    setObjTenantType("external"); setObjCustomerSearch(""); setObjCustomerId("");
    setObjTenantName(""); setObjTenantPhone(""); setObjTenantFin(""); setObjAssetId("");
    setObjContractNumber(""); setObjPricePerSqm(""); setObjMonthlyAmount("");
    setObjStartDate(""); setObjEndDate("");
  }

  async function submitGarageRental() {
    if (!selectedGarageId || !garageStartDate || !garageEndDate || !garageMonthlyAmount) {
      toast({ title: "Xəta", description: "Dayanacaq, tarixlər və aylıq məbləğ tələb olunur", variant: "destructive" }); return;
    }
    const selectedCust = customers?.find((c: any) => c.id.toString() === selectedCustomerId);
    const tenantName = selectedCust ? `${selectedCust.firstName} ${selectedCust.lastName}` : "";
    const tenantPhone = selectedCust?.phone ?? "";
    const tenantFin = selectedCust?.fin ?? "";

    if (!tenantName) {
      toast({ title: "Xəta", description: "Sakin seçilməlidir", variant: "destructive" }); return;
    }

    setIsPending(true);
    const res = await fetch(`${BASE()}/api/rentals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: "garage",
        assetId: Number(selectedGarageId),
        customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
        contractNumber: garageContractNumber || null,
        tenantName, tenantPhone, tenantFin: tenantFin || null,
        startDate: new Date(garageStartDate).toISOString(),
        endDate: new Date(garageEndDate).toISOString(),
        pricePerSqm: null,
        monthlyAmount: Number(garageMonthlyAmount),
      }),
    });
    setIsPending(false);
    if (res.ok) {
      setGarageDialogOpen(false); resetGarageDialog(); refetch();
      toast({ title: "Uğurlu", description: "Avto dayanacaq icarəsi yaradıldı." });
    } else {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      toast({ title: "Xəta", description: err.error, variant: "destructive" });
    }
  }

  async function submitObjectRental() {
    if (!objAssetId || !objStartDate || !objEndDate) {
      toast({ title: "Xəta", description: "Obyekt və tarixlər tələb olunur", variant: "destructive" }); return;
    }
    if (!objTenantName || !objTenantPhone) {
      toast({ title: "Xəta", description: "İcarədar adı və telefonu tələb olunur", variant: "destructive" }); return;
    }
    const monthly = objMonthlyAmount || calcObjMonthly();
    if (!monthly) {
      toast({ title: "Xəta", description: "Aylıq kira məbləği tələb olunur", variant: "destructive" }); return;
    }

    setIsPending(true);
    const res = await fetch(`${BASE()}/api/rentals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: "object",
        assetId: Number(objAssetId),
        customerId: objTenantType === "resident" && objCustomerId ? Number(objCustomerId) : null,
        contractNumber: objContractNumber || null,
        tenantName: objTenantName,
        tenantPhone: objTenantPhone,
        tenantFin: objTenantFin || null,
        startDate: new Date(objStartDate).toISOString(),
        endDate: new Date(objEndDate).toISOString(),
        pricePerSqm: objPricePerSqm ? Number(objPricePerSqm) : null,
        monthlyAmount: Number(monthly),
      }),
    });
    setIsPending(false);
    if (res.ok) {
      setObjectDialogOpen(false); resetObjectDialog(); refetch();
      toast({ title: "Uğurlu", description: "Qeyri yaşayış icarə müqaviləsi yaradıldı." });
    } else {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      toast({ title: "Xəta", description: err.error, variant: "destructive" });
    }
  }

  async function loadPayments(rentalId: number) {
    if (rentalPayments[rentalId]) { setExpandedId(expandedId === rentalId ? null : rentalId); return; }
    setLoadingPayments(p => ({ ...p, [rentalId]: true }));
    const res = await fetch(`${BASE()}/api/object-payments/rental/${rentalId}`);
    const data = await res.json();
    setRentalPayments(p => ({ ...p, [rentalId]: data }));
    setLoadingPayments(p => ({ ...p, [rentalId]: false }));
    setExpandedId(rentalId);
  }

  async function togglePayment(rentalId: number, payment: any) {
    const isPaid = payment.status === "paid";
    const res = await fetch(`${BASE()}/api/object-payments/${payment.id}/${isPaid ? "unpay" : "pay"}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate: new Date().toISOString().split("T")[0] }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRentalPayments(prev => ({ ...prev, [rentalId]: prev[rentalId].map(p => p.id === updated.id ? updated : p) }));
    }
  }

  async function handleTerminate(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/rentals/${actionRental.id}/terminate`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({ error: "Xəta" })); throw new Error(e.error); }
    toast({ title: "İcarə dayandırıldı" });
    refetch();
  }

  async function handleDelete(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/rentals/${actionRental.id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({ error: "Xəta" })); throw new Error(e.error); }
    toast({ title: "İcarə silindi" });
    refetch();
  }

  async function handleCrossBuildingAdmin(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/admin/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) throw new Error("Yanlış şifrə");
    setCrossBuildingAllowed(true);
  }

  const sharedTableProps = {
    isAdmin, user, BASE, onLoadPayments: loadPayments, expandedId, loadingPayments,
    rentalPayments, togglePayment,
    onTerminate: (r: any) => { setActionRental(r); setTerminateOpen(true); },
    onDelete: (r: any) => { setActionRental(r); setDeleteOpen(true); },
  };

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">İcarələr</h1>
            <p className="text-muted-foreground mt-1">Avto dayanacaq və qeyri yaşayış sahəsi müqavilələri</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Car className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{garageRentals.filter((r: any) => r.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Aktiv dayanacaq</p>
              <p className="text-xs text-indigo-600 font-medium">{formatCurrency(garageRentals.filter((r: any) => r.status === "active").reduce((s: number, r: any) => s + Number(r.monthlyAmount), 0))} / ay</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Store className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{objectRentals.filter((r: any) => r.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Aktiv qeyri yaşayış</p>
              <p className="text-xs text-amber-600 font-medium">{formatCurrency(objectRentals.filter((r: any) => r.status === "active").reduce((s: number, r: any) => s + Number(r.monthlyAmount), 0))} / ay</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          <button onClick={() => setActiveTab("garage")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "garage" ? "bg-white shadow-sm text-indigo-700" : "text-muted-foreground hover:text-foreground"}`}>
            <Car className="w-4 h-4" /> Avto Dayanacaq
            <Badge variant="outline" className="ml-1 text-xs bg-indigo-50 border-indigo-200 text-indigo-700">{garageRentals.length}</Badge>
          </button>
          <button onClick={() => setActiveTab("object")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "object" ? "bg-white shadow-sm text-amber-700" : "text-muted-foreground hover:text-foreground"}`}>
            <Store className="w-4 h-4" /> Qeyri Yaşayış
            <Badge variant="outline" className="ml-1 text-xs bg-amber-50 border-amber-200 text-amber-700">{objectRentals.length}</Badge>
          </button>
        </div>

        {/* ── GARAGE TAB ── */}
        {activeTab === "garage" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Mövcud sakinlərə binalarına uyğun avto dayanacaq icarəyə verilir</p>
              <Button onClick={() => setGarageDialogOpen(true)}
                className="rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
                <Plus className="w-4 h-4 mr-2" /> Yeni Dayanacaq İcarəsi
              </Button>
            </div>
            {isLoading ? <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              : <RentalTable rentals={garageRentals} {...sharedTableProps} />}
          </div>
        )}

        {/* ── OBJECT TAB ── */}
        {activeTab === "object" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Kommersiya sahələrinin sakin və ya kənar şəxslərə icarəsi</p>
              <Button onClick={() => setObjectDialogOpen(true)}
                className="rounded-xl px-5 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20">
                <Plus className="w-4 h-4 mr-2" /> Yeni Qeyri Yaşayış İcarəsi
              </Button>
            </div>
            {isLoading ? <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              : <RentalTable rentals={objectRentals} {...sharedTableProps} />}
          </div>
        )}
      </div>

      {/* ══ GARAGE DIALOG ══════════════════════════════════════════════════ */}
      <Dialog open={garageDialogOpen} onOpenChange={v => { setGarageDialogOpen(v); if (!v) resetGarageDialog(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Car className="w-5 h-5 text-indigo-600" /> Avto Dayanacaq İcarəsi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* ── Step 1: Select resident ── */}
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                <User className="w-4 h-4" /> Sakin Seçin
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={garageCustomerSearch} onChange={e => setGarageCustomerSearch(e.target.value)}
                  placeholder="Ad, soyad və ya telefon..." className="rounded-xl h-9 pl-8 text-sm" />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5">
                {filteredGarageCustomers.map((c: any) => (
                  <button key={c.id} type="button"
                    onClick={() => setSelectedCustomerId(prev => prev === c.id.toString() ? "" : c.id.toString())}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all border flex items-center justify-between ${selectedCustomerId === c.id.toString() ? "bg-indigo-100 border-indigo-400 text-indigo-800" : "bg-white border-border/50 hover:border-indigo-300"}`}>
                    <div>
                      <span className="font-medium">{c.firstName} {c.lastName}</span>
                      {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
                    </div>
                    {selectedCustomerId === c.id.toString() && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Building info */}
              {selectedCustomerId && (
                loadingBuilding ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Bina məlumatı yüklənir...
                  </div>
                ) : customerBuilding?.buildingId ? (
                  <div className="bg-white rounded-lg border border-indigo-200 px-3 py-2 text-xs flex items-center gap-2 text-indigo-700">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Mənzil: <strong>{customerBuilding.quarterName} — {customerBuilding.buildingName}</strong>, Mənzil №{customerBuilding.apartmentNumber}</span>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 px-3 py-2 text-xs flex items-center gap-2 text-amber-700">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Bu sakin üçün mənzil satışı tapılmadı. İstənilən dayanacaqdan seçə bilərsiniz.
                  </div>
                )
              )}
            </div>

            {/* ── Step 2: Select garage ── */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-500" /> Dayanacaq Seçin
              </p>

              {selectedCustomerId && customerBuilding?.buildingId && (
                <div className="space-y-2">
                  {/* Same building */}
                  {sameBuildingGarages.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Sakinin binasından ({customerBuilding.buildingName}) — {sameBuildingGarages.length} boş yer
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {sameBuildingGarages.map((g: any) => (
                          <GarageSpotButton key={g.id} garage={g} selected={selectedGarageId === g.id.toString()}
                            onClick={() => setSelectedGarageId(prev => prev === g.id.toString() ? "" : g.id.toString())} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                      {customerBuilding.buildingName} binasında boş avto dayanacaq yoxdur.
                    </div>
                  )}

                  {/* Cross-building */}
                  {!crossBuildingAllowed ? (
                    <div className="pt-1">
                      <button type="button" onClick={() => setCrossBuildingOpen(true)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Admin icazəsi ilə başqa binadan seç
                      </button>
                    </div>
                  ) : (
                    otherBuildingGarages.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Digər binalardan (admin icazəsi ilə)
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {otherBuildingGarages.map((g: any) => (
                            <GarageSpotButton key={g.id} garage={g} selected={selectedGarageId === g.id.toString()}
                              onClick={() => setSelectedGarageId(prev => prev === g.id.toString() ? "" : g.id.toString())} dim />
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* No customer selected or no building: show all */}
              {(!selectedCustomerId || !customerBuilding?.buildingId) && (
                <div className="grid grid-cols-2 gap-1.5">
                  {garages.length === 0
                    ? <p className="text-sm text-muted-foreground col-span-2">Boş dayanacaq yoxdur</p>
                    : garages.map((g: any) => (
                      <GarageSpotButton key={g.id} garage={g} selected={selectedGarageId === g.id.toString()}
                        onClick={() => setSelectedGarageId(prev => prev === g.id.toString() ? "" : g.id.toString())} />
                    ))
                  }
                </div>
              )}

              {selectedGarage && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
                  <Car className="w-3.5 h-3.5" />
                  Seçilmiş: <strong>{selectedGarage.number}</strong>
                  {selectedGarage.blockName && <span className="opacity-70">({selectedGarage.blockName})</span>}
                  · Sabit aylıq: <strong>{formatCurrency(selectedGarage.monthlyRent)}</strong>
                </div>
              )}
            </div>

            {/* ── Contract details ── */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Müqavilə Məlumatları</p>
              <div>
                <label className="text-sm font-medium">Müqavilə №</label>
                <Input value={garageContractNumber} onChange={e => setGarageContractNumber(e.target.value)}
                  className="rounded-xl h-10 mt-1" placeholder="MQ-2025-001" />
              </div>
              <div>
                <label className="text-sm font-medium">Aylıq İcarə (₼)</label>
                <Input type="number" value={garageMonthlyAmount} onChange={e => setGarageMonthlyAmount(e.target.value)}
                  className="rounded-xl h-10 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Başlama</label>
                  <Input type="date" value={garageStartDate} onChange={e => setGarageStartDate(e.target.value)} className="rounded-xl h-10 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Bitmə</label>
                  <Input type="date" value={garageEndDate} onChange={e => setGarageEndDate(e.target.value)} className="rounded-xl h-10 mt-1" />
                </div>
              </div>
            </div>

            <Button onClick={submitGarageRental} disabled={isPending} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Müqavilə Yarat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cross-building admin approval ── */}
      <AdminEditDialog open={crossBuildingOpen} onClose={() => setCrossBuildingOpen(false)}
        title="Admin İcazəsi Tələb Olunur" onSave={handleCrossBuildingAdmin}
        saveLabel="İcazə Ver">
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Sakinin öz binasından fərqli bir binadan avto dayanacaq icarəyə vermək üçün admin şifrəsi tələb olunur.</p>
          </div>
        </div>
      </AdminEditDialog>

      {/* ══ OBJECT DIALOG ══════════════════════════════════════════════════ */}
      <Dialog open={objectDialogOpen} onOpenChange={v => { setObjectDialogOpen(v); if (!v) resetObjectDialog(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" /> Qeyri Yaşayış İcarəsi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Tenant type toggle */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
              <button type="button" onClick={() => { setObjTenantType("external"); setObjCustomerId(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${objTenantType === "external" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                Kənar Şəxs
              </button>
              <button type="button" onClick={() => setObjTenantType("resident")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${objTenantType === "resident" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                Mövcud Sakin
              </button>
            </div>

            {/* Resident search */}
            {objTenantType === "resident" && (
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={objCustomerSearch} onChange={e => setObjCustomerSearch(e.target.value)}
                    placeholder="Sakin axtar..." className="rounded-xl h-9 pl-8 text-sm" />
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {filteredObjCustomers.map((c: any) => (
                    <button key={c.id} type="button"
                      onClick={() => setObjCustomerId(prev => prev === c.id.toString() ? "" : c.id.toString())}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm border flex items-center justify-between transition-all ${objCustomerId === c.id.toString() ? "bg-amber-50 border-amber-400 text-amber-800" : "bg-white border-border/50 hover:border-amber-300"}`}>
                      <span><span className="font-medium">{c.firstName} {c.lastName}</span>{c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}</span>
                      {objCustomerId === c.id.toString() && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tenant info */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">İcarədar Məlumatları</p>
              <div>
                <label className="text-sm font-medium">Adı Soyadı</label>
                <Input value={objTenantName} onChange={e => setObjTenantName(e.target.value)}
                  className="rounded-xl h-10 mt-1" placeholder="Əli Həsənov" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Mobil</label>
                  <Input value={objTenantPhone} onChange={e => setObjTenantPhone(e.target.value)}
                    className="rounded-xl h-10 mt-1" placeholder="+994..." />
                </div>
                <div>
                  <label className="text-sm font-medium">FIN</label>
                  <Input value={objTenantFin} onChange={e => setObjTenantFin(e.target.value)}
                    className="rounded-xl h-10 mt-1" maxLength={7} />
                </div>
              </div>
            </div>

            {/* Asset selection */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sahə Seçin</p>
              <Select value={objAssetId} onValueChange={setObjAssetId}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Boş obyekt seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {objectAssets.length === 0
                    ? <SelectItem value="none" disabled>Boş obyekt yoxdur</SelectItem>
                    : objectAssets.map((o: any) => (
                      <SelectItem key={o.id} value={o.id.toString()}>
                        <span className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-amber-500" />
                          Obyekt {o.number}{o.area ? ` — ${o.area} m²` : ""}
                          {o.blockName ? ` (${o.blockName})` : ""}
                        </span>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              {selectedObjectAsset && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <Store className="w-3.5 h-3.5" />
                  Sahə: <strong>{selectedObjectAsset.area} m²</strong>
                  · Tarifdən hesablanmış: <strong>{formatCurrency(selectedObjectAsset.monthlyRent)} / ay</strong>
                </div>
              )}
            </div>

            {/* Contract details */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Müqavilə Məlumatları</p>
              <div>
                <label className="text-sm font-medium">Müqavilə №</label>
                <Input value={objContractNumber} onChange={e => setObjContractNumber(e.target.value)}
                  className="rounded-xl h-10 mt-1" placeholder="MQ-2025-001" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">m² Qiyməti (₼)</label>
                  <Input type="number" step="0.01" value={objPricePerSqm} onChange={e => { setObjPricePerSqm(e.target.value); setObjMonthlyAmount(""); }}
                    className="rounded-xl h-10 mt-1" placeholder="Tarifdən" />
                </div>
                <div>
                  <label className="text-sm font-medium">Aylıq Kira (₼)</label>
                  <Input type="number" step="0.01" value={objMonthlyAmount || calcObjMonthly()}
                    onChange={e => setObjMonthlyAmount(e.target.value)}
                    className="rounded-xl h-10 mt-1" placeholder="Avtomatik" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Başlama</label>
                  <Input type="date" value={objStartDate} onChange={e => setObjStartDate(e.target.value)} className="rounded-xl h-10 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Bitmə</label>
                  <Input type="date" value={objEndDate} onChange={e => setObjEndDate(e.target.value)} className="rounded-xl h-10 mt-1" />
                </div>
              </div>
            </div>

            <Button onClick={submitObjectRental} disabled={isPending} className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700">
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Müqavilə Yarat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminate / Delete dialogs */}
      <AdminEditDialog open={terminateOpen} onClose={() => setTerminateOpen(false)}
        title="İcarəni Dayandır" onSave={handleTerminate} saveLabel="Dayandır" saveVariant="destructive">
        <p className="text-sm text-muted-foreground">
          <strong>{actionRental?.assetDescription}</strong> üçün icarə müqaviləsi dayandırılacaq. Dayanacaq / sahə yenidən "boş" kimi göstəriləcək.
        </p>
      </AdminEditDialog>

      <AdminEditDialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
        title="İcarəni Sil" onSave={handleDelete} saveLabel="Sil" saveVariant="destructive">
        <p className="text-sm text-muted-foreground">
          <strong>{actionRental?.assetDescription}</strong> üçün bütün ödəniş tarixçəsi ilə birlikdə silinəcək.
        </p>
      </AdminEditDialog>
    </AppLayout>
  );
}

// ─── Garage spot button ──────────────────────────────────────────────────────
function GarageSpotButton({ garage, selected, onClick, dim }: { garage: any; selected: boolean; onClick: () => void; dim?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border p-2.5 text-left transition-all text-xs ${selected ? "bg-indigo-100 border-indigo-500 text-indigo-900" : dim ? "bg-white border-border/40 text-muted-foreground hover:border-indigo-200" : "bg-white border-border/60 hover:border-indigo-300"}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold font-mono">{garage.number}</span>
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
      </div>
      {garage.blockName && <div className="text-[10px] opacity-60 mt-0.5 truncate">{garage.blockName}</div>}
    </button>
  );
}
