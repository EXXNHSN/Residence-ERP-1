import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Search, Phone, Pencil, Trash2, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCustomersQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editFin, setEditFin] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const { data: customers, isLoading } = useListCustomers({ search: search || undefined });
  
  const queryClient = useQueryClient();
  const { mutate: createCustomer, isPending } = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      }
    }
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      fin: "",
      phone: "",
      address: ""
    }
  });

  const onSubmit = (data: any) => {
    createCustomer({ data });
  };

  function openEdit(cust: any) {
    setEditingCustomer(cust);
    setEditFirstName(cust.firstName);
    setEditLastName(cust.lastName);
    setEditPhone(cust.phone);
    setEditFin(cust.fin ?? "");
    setEditAddress(cust.address ?? "");
    setEditOpen(true);
  }

  function openDelete(cust: any) {
    setDeletingCustomer(cust);
    setDeleteOpen(true);
  }

  async function handleDeleteCustomer(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/customers/${deletingCustomer.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `${deletingCustomer.firstName} ${deletingCustomer.lastName} silindi` });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  }

  async function handleSaveCustomer(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/customers/${editingCustomer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user?.username,
        password: adminPassword,
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        fin: editFin,
        address: editAddress,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `${editFirstName} ${editLastName} yeniləndi` });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Sakinlər</h1>
            <p className="text-muted-foreground mt-1">Sakin reyestri</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Axtar..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl bg-card border-none shadow-sm"
              />
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 shrink-0">
                  <Plus className="w-5 h-5 mr-2" /> Yeni
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-display">Yeni Sakin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ad</label>
                      <Input {...register("firstName", { required: true })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Soyad</label>
                      <Input {...register("lastName", { required: true })} className="rounded-xl h-11" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">FIN Kod</label>
                      <Input {...register("fin")} className="rounded-xl h-11" maxLength={7} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Telefon</label>
                      <Input {...register("phone", { required: true })} className="rounded-xl h-11" placeholder="+994..." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ünvan</label>
                    <Input {...register("address")} className="rounded-xl h-11" />
                  </div>

                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-md mt-4">
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Əlavə et"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Sakin</TableHead>
                  <TableHead>FIN</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  customers?.map((cust) => (
                    <TableRow key={cust.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {cust.firstName[0]}{cust.lastName[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{cust.firstName} {cust.lastName}</div>
                            <div className="text-xs text-muted-foreground">ID: #{cust.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{cust.fin || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" /> {cust.phone}
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      <AdminEditDialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
        title="Sakini Sil" onSave={handleDeleteCustomer} saveLabel="Sil" saveVariant="destructive">
        {deletingCustomer && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Aşağıdakı sakini silmək istədiyinizə əminsiniz?</p>
            <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-xl px-4 py-3 font-semibold">
              <User className="w-4 h-4 shrink-0" />
              {deletingCustomer.firstName} {deletingCustomer.lastName}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              Sakin silinəndə ona aid bütün satışlar da silinir və satılmış mənzillər yenidən boş olaraq göstərilir.
            </p>
          </div>
        )}
      </AdminEditDialog>

      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Sakini Redaktə et" onSave={handleSaveCustomer}>
        {editingCustomer && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ad</label>
                <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Soyad</label>
                <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                  className="rounded-xl h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefon</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="rounded-xl h-11" placeholder="+994..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">FIN Kod</label>
                <Input value={editFin} onChange={(e) => setEditFin(e.target.value)}
                  className="rounded-xl h-11" maxLength={7} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ünvan</label>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                className="rounded-xl h-11" />
            </div>
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
