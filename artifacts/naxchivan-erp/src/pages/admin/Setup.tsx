import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Building2, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

interface BuildingConfig {
  name: string;
  floors: number;
  apartmentsPerFloor: number;
  apartmentArea: number;
  rooms: number;
}

interface QuarterConfig {
  name: string;
  description: string;
  buildings: BuildingConfig[];
}

const defaultBuilding = (): BuildingConfig => ({
  name: "",
  floors: 9,
  apartmentsPerFloor: 4,
  apartmentArea: 80,
  rooms: 2,
});

export default function AdminSetupPage() {
  const { isAdmin } = useAuth();
  const [, nav] = useLocation();
  const { toast } = useToast();

  const [quarters, setQuarters] = useState<QuarterConfig[]>([
    { name: "A", description: "", buildings: [defaultBuilding()] },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">Bu səhifəyə yalnız admin daxil ola bilər.</div>
    );
  }

  const addQuarter = () =>
    setQuarters((q) => [...q, { name: String.fromCharCode(65 + q.length), description: "", buildings: [defaultBuilding()] }]);

  const removeQuarter = (qi: number) =>
    setQuarters((q) => q.filter((_, i) => i !== qi));

  const updateQuarter = (qi: number, field: keyof QuarterConfig, value: string) =>
    setQuarters((q) => q.map((item, i) => (i === qi ? { ...item, [field]: value } : item)));

  const addBuilding = (qi: number) =>
    setQuarters((q) =>
      q.map((item, i) =>
        i === qi ? { ...item, buildings: [...item.buildings, defaultBuilding()] } : item
      )
    );

  const removeBuilding = (qi: number, bi: number) =>
    setQuarters((q) =>
      q.map((item, i) =>
        i === qi ? { ...item, buildings: item.buildings.filter((_, j) => j !== bi) } : item
      )
    );

  const updateBuilding = (qi: number, bi: number, field: keyof BuildingConfig, value: string | number) =>
    setQuarters((q) =>
      q.map((item, i) =>
        i === qi
          ? {
              ...item,
              buildings: item.buildings.map((b, j) =>
                j === bi ? { ...b, [field]: typeof value === "string" ? value : Number(value) } : b
              ),
            }
          : item
      )
    );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/admin/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarters }),
      });
      if (!res.ok) throw new Error("Quraşdırma uğursuz oldu");
      setDone(true);
      toast({ title: "Layihə uğurla quraşdırıldı!" });
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-6 mt-16">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold">Layihə quraşdırıldı!</h2>
        <p className="text-muted-foreground">
          Bütün məhəllə, bina və mənzillər sistemə əlavə edildi.
          İndi hər mənzilin sahəsini (m²) və otaq sayını konfiqürasiya səhifəsindən ayrıca tənzimləyə bilərsiniz.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => nav("/admin/configure")} className="w-full max-w-xs gap-2">
            Mənzil konfiqürasiyasına keç →
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => nav("/blocks")}>Binaları gör</Button>
            <Button variant="outline" size="sm" onClick={() => nav("/apartments")}>Mənzillər</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Layihə Quraşdırması</h1>
          <p className="text-muted-foreground text-sm mt-1">Məhəllələr, binalar və mənzilləri toplu əlavə edin</p>
        </div>
        <Button onClick={addQuarter} variant="outline" className="gap-2">
          <PlusCircle className="w-4 h-4" /> Məhəllə əlavə et
        </Button>
      </div>

      <div className="space-y-6">
        {quarters.map((q, qi) => (
          <Card key={qi} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {q.name || "?"}
                </div>
                <div className="flex-1 flex gap-3">
                  <Input
                    placeholder="Məhəllə adı (məs. A)"
                    value={q.name}
                    onChange={(e) => updateQuarter(qi, "name", e.target.value)}
                    className="max-w-[150px] h-9 font-bold"
                  />
                  <Input
                    placeholder="Təsvir (ixtiyari)"
                    value={q.description}
                    onChange={(e) => updateQuarter(qi, "description", e.target.value)}
                    className="h-9"
                  />
                </div>
                {quarters.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeQuarter(qi)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Binalar
              </div>
              {q.buildings.map((b, bi) => (
                <div key={bi} className="flex flex-wrap gap-2 items-center bg-muted/40 rounded-xl p-3">
                  <Input
                    placeholder="Bina adı"
                    value={b.name}
                    onChange={(e) => updateBuilding(qi, bi, "name", e.target.value)}
                    className="w-36 h-8 text-sm"
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Mərtəbə:</span>
                    <Input
                      type="number"
                      min={1}
                      value={b.floors}
                      onChange={(e) => updateBuilding(qi, bi, "floors", e.target.value)}
                      className="w-16 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Mənzil/mərtəbə:</span>
                    <Input
                      type="number"
                      min={1}
                      value={b.apartmentsPerFloor}
                      onChange={(e) => updateBuilding(qi, bi, "apartmentsPerFloor", e.target.value)}
                      className="w-16 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Sahə (m²):</span>
                    <Input
                      type="number"
                      min={1}
                      value={b.apartmentArea}
                      onChange={(e) => updateBuilding(qi, bi, "apartmentArea", e.target.value)}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Otaq:</span>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={b.rooms}
                      onChange={(e) => updateBuilding(qi, bi, "rooms", e.target.value)}
                      className="w-16 h-8 text-sm"
                    />
                  </div>
                  {q.buildings.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBuilding(qi, bi)}
                      className="text-destructive h-8 w-8"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => addBuilding(qi)}
                className="gap-1 text-xs"
              >
                <Building2 className="w-3 h-3" /> Bina əlavə et
              </Button>

              <div className="text-xs text-muted-foreground pt-1">
                Cəmi:{" "}
                <span className="font-semibold text-foreground">
                  {q.buildings.reduce((s, b) => s + b.floors * b.apartmentsPerFloor, 0)}
                </span>{" "}
                mənzil
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <div className="text-sm text-muted-foreground self-center">
          Cəmi:{" "}
          <span className="font-bold text-foreground">
            {quarters.reduce(
              (s, q) => s + q.buildings.reduce((bs, b) => bs + b.floors * b.apartmentsPerFloor, 0),
              0
            )}
          </span>{" "}
          mənzil
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 px-8">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Quraşdır
        </Button>
      </div>
    </div>
  );
}
