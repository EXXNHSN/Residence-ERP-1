import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Building2, Home } from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface Quarter {
  id: number;
  name: string;
  description: string | null;
  buildingCount: number;
  apartmentCount: number;
}

async function fetchQuarters(): Promise<Quarter[]> {
  const res = await fetch(`${BASE()}/api/quarters`);
  return res.json();
}

export default function QuartersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: quarters = [] } = useQuery<Quarter[]>({
    queryKey: ["quarters"],
    queryFn: fetchQuarters,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE()}/api/quarters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarters"] });
      setOpen(false);
      setForm({ name: "", description: "" });
      toast({ title: "Məhəllə əlavə edildi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE()}/api/quarters/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarters"] });
      toast({ title: "Məhəllə silindi" });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Məhəllələr</h1>
          <p className="text-muted-foreground text-sm mt-1">Yaşayış məhəllələrini idarə edin</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <PlusCircle className="w-4 h-4" /> Yeni məhəllə
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quarters.map((q) => (
          <Card key={q.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl">
                  {q.name}
                </div>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(q.id)}
                    className="text-destructive h-8 w-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <h3 className="font-bold text-lg">{q.name} Məhəlləsi</h3>
              {q.description && <p className="text-sm text-muted-foreground mt-1">{q.description}</p>}
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>{q.buildingCount} bina</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Home className="w-4 h-4" />
                  <span>{q.apartmentCount} mənzil</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {quarters.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            Hələ məhəllə əlavə edilməyib
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Məhəllə</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ad</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="A"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Təsvir (ixtiyari)</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Şimal bloku"
              />
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              Əlavə et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
