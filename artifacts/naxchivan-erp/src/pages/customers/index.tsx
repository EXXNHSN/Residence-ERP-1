import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Search, Phone, Pencil, Trash2, User, Home, Car, Store, ParkingCircle, Building2, CreditCard } from "lucide-react";
import { IdCardInput, type IdCardType } from "@/components/IdCardInput";
import { useQueryClient } from "@tanstack/react-query";
import { getListCustomersQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

// Badge icons configuration
const BADGE_CONFIG = [
  { key: "apartment",    icon: Home,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",    tip: "Mənzil sahibi" },
  { key: "objectSale",   icon: Building2,     color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", tip: "Qeyri yaşayış satın alıb" },
  { key: "garageSale",   icon: Car,           color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200",  tip: "Avto dayanacaq sahibi" },
  { key: "garageRental", icon: ParkingCircle, color: "text-indigo-400", bg: "bg-indigo-50/60 border-indigo-100", tip: "Avto dayanacaq icarəçisi" },
  { key: "objectRental", icon: Store,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   tip: "Qeyri yaşayış icarəçisi" },
];

function CustomerTypeBadge({ badges }: { badges: any }) {
  const isResident = badges.apartment || badges.objectSale;
  const isRenterOnly = !isResident && (badges.objectRental || badges.garageRental || badges.garageSale);
  if (isResident) return (
    <Badge variant="outline" className="text-[10px] font-semibold border-blue-300 bg-blue-50 text-blue-700 px-1.5 py-0 h-4">
      Sakin
    </Badge>
  );
  if (isRenterOnly) return (
    <Badge variant="outline" className="text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-700 px-1.5 py-0 h-4">
      İcarəçi
    </Badge>
  );
  return null;
}

function StatusIcons({ badges }: { badges: any }) {
  if (!badges || Object.keys(badges).length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {BADGE_CONFIG.filter(b => badges[b.key]).map(b => {
        const Icon = b.icon;
        return (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <div className={`w-5 h-5 rounded border flex items-center justify-center ${b.bg} cursor-default`}>
                <Icon className={`w-3 h-3 ${b.color}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{b.tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function validateFin(fin: string) {
  if (!fin) return true; // FIN is optional
  if (fin.length !== 7) return "FIN kodu dəqiq 7 simvol olmalıdır";
  if (!/^[A-Za-z0-9]{7}$/.test(fin)) return "FIN kodunda yalnız hərf və rəqəm ola bilər";
  return true;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "apartment" | "objectSale">("all");
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editFatherName, setEditFatherName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editFin, setEditFin] = useState("");
  const [editFinError, setEditFinError] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editIdCardType, setEditIdCardType] = useState<IdCardType>("");
  const [editIdCardNumber, setEditIdCardNumber] = useState("");

  // Create form ID card state
  const [createIdCardType, setCreateIdCardType] = useState<IdCardType>("");
  const [createIdCardNumber, setCreateIdCardNumber] = useState("");

  const { data: customers, isLoading } = useListCustomers({ search: search || undefined });
  const queryClient = useQueryClient();
  const { mutate: createCustomer, isPending } = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        setCreateIdCardType("");
        setCreateIdCardNumber("");
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      }
    }
  });

  const { register, handleSubmit, reset, formState: { errors }, watch, setError } = useForm({
    defaultValues: { firstName: "", lastName: "", fatherName: "", fin: "", phone: "", address: "" }
  });

  const onSubmit = (data: any) => {
    const finErr = validateFin(data.fin);
    if (finErr !== true) { setError("fin", { message: finErr }); return; }
    createCustomer({
      data: {
        ...data,
        fatherName: data.fatherName?.trim() || null,
        fin: data.fin?.trim().toUpperCase() || null,
        idCardType: createIdCardType || null,
        idCardNumber: createIdCardNumber?.trim() || null,
      } as any
    });
  };

  function openEdit(cust: any) {
    setEditingCustomer(cust);
    setEditFirstName(cust.firstName);
    setEditLastName(cust.lastName);
    setEditFatherName(cust.fatherName ?? "");
    setEditPhone(cust.phone);
    setEditFin(cust.fin ?? "");
    setEditFinError(null);
    setEditAddress(cust.address ?? "");
    setEditIdCardType((cust.idCardType as IdCardType) ?? "");
    setEditIdCardNumber(cust.idCardNumber ?? "");
    setEditOpen(true);
  }

  function openDelete(cust: any) { setDeletingCustomer(cust); setDeleteOpen(true); }

  async function handleDeleteCustomer(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/customers/${deletingCustomer.id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: "Xəta" })); throw new Error(err.error ?? "Xəta baş verdi"); }
    toast({ title: `${deletingCustomer.firstName} ${deletingCustomer.lastName} silindi` });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  }

  async function handleSaveCustomer(adminPassword: string) {
    const finErr = validateFin(editFin);
    if (finErr !== true) { setEditFinError(finErr); throw new Error(finErr); }
    setEditFinError(null);
    const res = await fetch(`${BASE()}/api/customers/${editingCustomer.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username, password: adminPassword,
        firstName: editFirstName, lastName: editLastName,
        fatherName: editFatherName?.trim() || null,
        phone: editPhone,
        fin: editFin?.trim().toUpperCase() || null, address: editAddress,
        idCardType: editIdCardType || null,
        idCardNumber: editIdCardNumber?.trim() || null,
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: "Xəta" })); throw new Error(err.error ?? "Xəta baş verdi"); }
    toast({ title: `${editFirstName} ${editLastName} yeniləndi` });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  }

  // Filter by type
  const filteredCustomers = customers?.filter((cust: any) => {
    if (filterType === "all") return true;
    const b = (cust as any).badges ?? {};
    if (filterType === "apartment") return !!b.apartment;
    if (filterType === "objectSale") return !!b.objectSale;
    return true;
  });

  const apartmentCount  = customers?.filter((c: any) => !!((c as any).badges ?? {}).apartment).length ?? 0;
  const objectSaleCount = customers?.filter((c: any) => !!((c as any).badges ?? {}).objectSale).length ?? 0;

  return (
    <TooltipProvider>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Sakinlər</h1>
              <p className="text-muted-foreground mt-1">Sakin və icarəçi reyestri</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Ad, FIN, telefon axtar..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 rounded-xl bg-card border-none shadow-sm" />
              </div>

              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 shrink-0">
                    <Plus className="w-5 h-5 mr-2" /> Yeni
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Yeni Sakin / İcarəçi</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Ad</label>
                        <Input {...register("firstName", { required: "Tələb olunur" })} className="rounded-xl h-11" />
                        {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message as string}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Soyad</label>
                        <Input {...register("lastName", { required: "Tələb olunur" })} className="rounded-xl h-11" />
                        {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message as string}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ata adı</label>
                      <Input {...register("fatherName")} className="rounded-xl h-11" placeholder="Ata adını daxil edin" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">FIN Kod <span className="text-xs text-muted-foreground">(7 simvol)</span></label>
                        <Input {...register("fin")} className="rounded-xl h-11 font-mono uppercase"
                          maxLength={7} placeholder="AX12345" />
                        {errors.fin && <p className="text-xs text-destructive">{errors.fin.message as string}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Telefon</label>
                        <Input {...register("phone", { required: "Tələb olunur" })} className="rounded-xl h-11" placeholder="+994..." />
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message as string}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ünvan</label>
                      <Input {...register("address")} className="rounded-xl h-11" />
                    </div>

                    <div className="border-t border-border/50 pt-3">
                      <IdCardInput
                        idCardType={createIdCardType}
                        idCardNumber={createIdCardNumber}
                        onTypeChange={setCreateIdCardType}
                        onNumberChange={setCreateIdCardNumber}
                      />
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-md mt-4">
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-muted/50 rounded-xl p-1 w-fit max-w-full">
            {/* Hamısı */}
            <button onClick={() => setFilterType("all")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterType === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <User className="w-3.5 h-3.5" />
              Hamısı
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filterType === "all" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{customers?.length ?? 0}</span>
            </button>

            {/* Divider */}
            <span className="w-px h-5 bg-border/60 mx-0.5" />

            {/* Mənzil alanlar */}
            <button onClick={() => setFilterType("apartment")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterType === "apartment" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Home className="w-3.5 h-3.5 text-blue-500" />
              Mənzil alanlar
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filterType === "apartment" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>{apartmentCount}</span>
            </button>

            {/* Qeyri Yaşayış alanlar */}
            <button onClick={() => setFilterType("objectSale")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterType === "objectSale" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Store className="w-3.5 h-3.5 text-amber-500" />
              Qeyri Yaşayış alanlar
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filterType === "objectSale" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{objectSaleCount}</span>
            </button>

          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-card rounded-xl border border-border/50 px-4 py-2.5">
            <span className="font-medium text-foreground">İkon açıqlaması:</span>
            {BADGE_CONFIG.map(b => {
              const Icon = b.icon;
              return (
                <span key={b.key} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${b.bg}`}>
                    <Icon className={`w-3 h-3 ${b.color}`} />
                  </div>
                  {b.tip}
                </span>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Sakin / İcarəçi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>FIN</TableHead>
                    <TableHead>Vəsiqə №</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Əməliyyat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                    </TableRow>
                  ) : filteredCustomers?.map((cust: any) => {
                    const badges = cust.badges ?? {};
                    const isResident = badges.apartment || badges.objectSale;
                    return (
                      <TableRow key={cust.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isResident ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                              {cust.firstName[0]}{cust.lastName[0]}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                                {cust.firstName} {cust.lastName}
                                <CustomerTypeBadge badges={badges} />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">#{cust.id}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusIcons badges={badges} />
                        </TableCell>
                        <TableCell>
                          {cust.fin
                            ? <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded-lg">{cust.fin}</span>
                            : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          {cust.idCardNumber
                            ? (
                              <div className="flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="font-mono text-sm">{cust.idCardNumber}</span>
                              </div>
                            )
                            : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Phone className="w-3.5 h-3.5 shrink-0" /> {cust.phone}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={() => openEdit(cust)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => openDelete(cust)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            <Link href={`/customers/${cust.id}`} className="text-primary hover:underline text-sm font-medium">
                              Ətraflı
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Delete dialog */}
        <AdminEditDialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
          title="Sakini / İcarəçini Sil" onSave={handleDeleteCustomer} saveLabel="Sil" saveVariant="destructive">
          {deletingCustomer && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Aşağıdakı şəxsi silmək istədiyinizə əminsiniz?</p>
              <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-xl px-4 py-3 font-semibold">
                <User className="w-4 h-4 shrink-0" />
                {deletingCustomer.firstName} {deletingCustomer.lastName}
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                Silinəndə ona aid bütün satış və icarə qeydləri də silinir.
              </p>
            </div>
          )}
        </AdminEditDialog>

        {/* Edit dialog */}
        <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
          title="Məlumatları Redaktə et" onSave={handleSaveCustomer}>
          {editingCustomer && (
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Ata adı</label>
                <Input value={editFatherName} onChange={e => setEditFatherName(e.target.value)} className="rounded-xl h-11" placeholder="Ata adını daxil edin" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefon</label>
                  <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="rounded-xl h-11" placeholder="+994..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">FIN Kod <span className="text-xs text-muted-foreground">(7 simvol)</span></label>
                  <Input value={editFin} onChange={e => { setEditFin(e.target.value.toUpperCase()); setEditFinError(null); }}
                    className={`rounded-xl h-11 font-mono ${editFinError ? "border-destructive" : ""}`} maxLength={7} placeholder="AX12345" />
                  {editFinError && <p className="text-xs text-destructive">{editFinError}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ünvan</label>
                <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="rounded-xl h-11" />
              </div>
              <div className="border-t border-border/50 pt-3">
                <IdCardInput
                  idCardType={editIdCardType}
                  idCardNumber={editIdCardNumber}
                  onTypeChange={setEditIdCardType}
                  onNumberChange={setEditIdCardNumber}
                />
              </div>
            </div>
          )}
        </AdminEditDialog>
      </AppLayout>
    </TooltipProvider>
  );
}
