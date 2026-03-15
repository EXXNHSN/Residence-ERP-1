import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListApartments, useCreateApartment, useListBlocks, ApartmentStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Home } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListApartmentsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatArea } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";

export default function ApartmentsPage() {
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);

  const { data: apartments, isLoading } = useListApartments({
    blockId: filterBlock !== "all" ? Number(filterBlock) : undefined,
    status: filterStatus !== "all" ? filterStatus as ApartmentStatus : undefined
  });
  
  const { data: blocks } = useListBlocks();
  
  const queryClient = useQueryClient();
  const { mutate: createApartment, isPending } = useCreateApartment({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListApartmentsQueryKey() });
      }
    }
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      blockId: "",
      number: "",
      floor: "",
      area: ""
    }
  });

  const onSubmit = (data: any) => {
    createApartment({
      data: {
        blockId: Number(data.blockId),
        number: data.number,
        floor: Number(data.floor),
        area: Number(data.area)
      }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Mənzillər</h1>
            <p className="text-muted-foreground mt-1">Bütün mənzillərin siyahısı və idarəsi</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={filterBlock} onValueChange={setFilterBlock}>
              <SelectTrigger className="w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="Blok" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Bloklar</SelectItem>
                {blocks?.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Statuslar</SelectItem>
                <SelectItem value={ApartmentStatus.available}>Boş</SelectItem>
                <SelectItem value={ApartmentStatus.sold}>Satılıb</SelectItem>
                <SelectItem value={ApartmentStatus.reserved}>Rezerv</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 shrink-0">
                  <Plus className="w-5 h-5 mr-2" /> Yeni
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-display">Yeni Mənzil</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blok</label>
                    <Controller
                      name="blockId"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {blocks?.map(b => (
                              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mənzil №</label>
                      <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: 15" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mərtəbə</label>
                      <Input type="number" {...register("floor", { required: true })} className="rounded-xl h-11" placeholder="Məs: 5" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sahə (m²)</label>
                    <Input type="number" step="0.01" {...register("area", { required: true })} className="rounded-xl h-11" placeholder="Məs: 85.5" />
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
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead>Mənzil №</TableHead>
                  <TableHead>Mərtəbə</TableHead>
                  <TableHead>Sahə</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  apartments?.map((apt) => (
                    <TableRow key={apt.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">#{apt.id}</TableCell>
                      <TableCell className="font-semibold text-foreground">{apt.blockName}</TableCell>
                      <TableCell className="flex items-center gap-2 font-bold">
                        <Home className="w-4 h-4 text-primary/70" /> {apt.number}
                      </TableCell>
                      <TableCell>{apt.floor}</TableCell>
                      <TableCell className="font-medium">{formatArea(apt.area)}</TableCell>
                      <TableCell><StatusBadge status={apt.status} type="apartment" /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
