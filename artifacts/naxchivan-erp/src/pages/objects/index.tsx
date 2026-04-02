import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListObjects, useCreateObject, useListBlocks, ObjectType, ObjectStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Store, MapPin, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListObjectsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatArea, formatCurrency } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";

export default function ObjectsPage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);

  const { data: objects, isLoading } = useListObjects({
    type: filterType !== "all" ? filterType as ObjectType : undefined,
    status: filterStatus !== "all" ? filterStatus as ObjectStatus : undefined
  });

  const { data: blocks } = useListBlocks();

  const queryClient = useQueryClient();
  const { mutate: createObj, isPending } = useCreateObject({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        reset();
        queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey() });
      }
    }
  });

  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: {
      type: ObjectType.object,
      number: "",
      area: "",
      blockId: "",
      activityType: ""
    }
  });

  const watchedType = watch("type");

  const onSubmit = (data: any) => {
    createObj({
      data: {
        type: data.type,
        number: data.number,
        area: Number(data.area),
        blockId: data.blockId ? Number(data.blockId) : undefined,
        activityType: data.activityType || undefined,
      } as any
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Obyektlər və Qarajlar</h1>
            <p className="text-muted-foreground mt-1">Ticarət obyektləri və qarajların idarəsi</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Tiplər</SelectItem>
                <SelectItem value={ObjectType.object}>Obyekt</SelectItem>
                <SelectItem value={ObjectType.garage}>Qaraj</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün Statuslar</SelectItem>
                <SelectItem value={ObjectStatus.available}>Boş</SelectItem>
                <SelectItem value={ObjectStatus.sold}>Satılıb</SelectItem>
                <SelectItem value={ObjectStatus.rented}>Kirayədə</SelectItem>
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
                  <DialogTitle className="text-xl font-display">Yeni Aktiv Əlavə Et</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tip</label>
                    <Controller name="type" control={control} rules={{ required: true }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ObjectType.object}>Obyekt</SelectItem>
                            <SelectItem value={ObjectType.garage}>Qaraj</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nömrə / Ad</label>
                    <Input {...register("number", { required: true })} className="rounded-xl h-11" placeholder="Məs: Obyekt 1A" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sahə (m²)</label>
                    <Input type="number" step="0.01" {...register("area", { required: true })} className="rounded-xl h-11" placeholder="Məs: 120" />
                  </div>

                  {watchedType === ObjectType.object && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Yerləşdiyi Bina (1-ci mərtəbə)</label>
                        <Controller name="blockId" control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="rounded-xl h-11">
                                <SelectValue placeholder="Bina seçin..." />
                              </SelectTrigger>
                              <SelectContent>
                                {blocks?.map(b => (
                                  <SelectItem key={b.id} value={b.id.toString()}>
                                    {b.name} {(b as any).quarterName ? `(${(b as any).quarterName})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fəaliyyət Sahəsi</label>
                        <Input {...register("activityType")} className="rounded-xl h-11"
                          placeholder="Məs: Ərzaq mağazası, Apteka..." />
                      </div>
                    </>
                  )}

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
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Nömrə / Ad</TableHead>
                  <TableHead>Yerləşdiyi Bina</TableHead>
                  <TableHead>Fəaliyyət</TableHead>
                  <TableHead>Sahə</TableHead>
                  <TableHead>Aylıq Kira</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  objects?.map((obj: any) => (
                    <TableRow key={obj.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">#{obj.id}</TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold">
                          {obj.type === "object" ? "Obyekt" : "Qaraj"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-bold">
                          <Store className="w-4 h-4 text-primary/70" /> {obj.number}
                        </div>
                      </TableCell>
                      <TableCell>
                        {obj.blockName ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              <Building2 className="w-3.5 h-3.5 text-primary/70" />
                              {obj.blockName} <span className="text-muted-foreground text-xs">(1-ci mərtəbə)</span>
                            </div>
                            {obj.quarterName && (
                              <Badge variant="outline" className="gap-1 text-xs font-normal">
                                <MapPin className="w-3 h-3" /> {obj.quarterName}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{obj.activityType || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="font-medium">{formatArea(obj.area)}</TableCell>
                      <TableCell className="font-semibold text-primary">{formatCurrency(obj.monthlyRent)}</TableCell>
                      <TableCell><StatusBadge status={obj.status} /></TableCell>
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
