import { AppLayout } from "@/components/layout/AppLayout";
import { useListTariffs, useUpdateTariffs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTariffsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function TariffsPage() {
  const { data: tariffs, isLoading } = useListTariffs();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      communalTariff: "",
      apartmentPricePerSqm: "",
      objectPricePerSqm: "",
      garagePricePerSqm: ""
    }
  });

  useEffect(() => {
    if (tariffs) {
      reset({
        communalTariff: tariffs.communalTariff.toString(),
        apartmentPricePerSqm: tariffs.apartmentPricePerSqm.toString(),
        objectPricePerSqm: tariffs.objectPricePerSqm.toString(),
        garagePricePerSqm: tariffs.garagePricePerSqm.toString(),
      });
    }
  }, [tariffs, reset]);

  const { mutate: updateTariffs, isPending } = useUpdateTariffs({
    mutation: {
      onSuccess: () => {
        toast({ title: "Uğurlu", description: "Tariflər yeniləndi." });
        queryClient.invalidateQueries({ queryKey: getListTariffsQueryKey() });
      }
    }
  });

  const onSubmit = (data: any) => {
    updateTariffs({
      data: {
        communalTariff: Number(data.communalTariff),
        apartmentPricePerSqm: Number(data.apartmentPricePerSqm),
        objectPricePerSqm: Number(data.objectPricePerSqm),
        garagePricePerSqm: Number(data.garagePricePerSqm),
      }
    });
  };

  if (isLoading) {
    return <AppLayout><div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sistem Tənzimləmələri</h1>
          <p className="text-muted-foreground mt-1">Qlobal tariflər və qiymətlərin idarəsi</p>
        </div>

        <Card className="border-none shadow-lg shadow-black/5">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle>Tariflər</CardTitle>
            <CardDescription>Bu qiymətlər yeni satışlar və kommunal hesablamalar zamanı avtomatik tətbiq olunur.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Kommunal Xidmət Tarifi (1 m² üçün aylıq AZN)</label>
                <Input type="number" step="0.01" {...register("communalTariff")} className="rounded-xl h-12 max-w-sm" />
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <h3 className="font-semibold text-lg">Standart Satış Qiymətləri</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Mənzil 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("apartmentPricePerSqm")} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Obyekt 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("objectPricePerSqm")} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Qaraj 1 m² (AZN)</label>
                    <Input type="number" step="0.01" {...register("garagePricePerSqm")} className="rounded-xl h-12" />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" disabled={isPending} className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Yadda Saxla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
