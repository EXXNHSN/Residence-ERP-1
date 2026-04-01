import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Trash2, Building2, ArrowRight, Loader2, CheckCircle2,
  Layers, Plus, X, GitBranch,
} from "lucide-react";

interface FloorRange {
  fromFloor: number;
  toFloor: number;
  apartmentsPerFloor: number;
  area: number;
  rooms: number;
}

interface BlockConfig {
  name: string;
  floorRanges: FloorRange[];
}

interface BuildingConfig {
  name: string;
  blocks: BlockConfig[];
}

interface QuarterConfig {
  name: string;
  description: string;
  buildings: BuildingConfig[];
}

function emptyRange(): FloorRange {
  return { fromFloor: 1, toFloor: 9, apartmentsPerFloor: 4, area: 80, rooms: 2 };
}
function emptyBlock(): BlockConfig { return { name: "", floorRanges: [emptyRange()] }; }
function emptyBuilding(): BuildingConfig { return { name: "", blocks: [emptyBlock()] }; }

function FloorRangeEditor({
  range, idx, canRemove, onChange, onRemove,
}: {
  range: FloorRange; idx: number; canRemove: boolean;
  onChange: (r: FloorRange) => void; onRemove: () => void;
}) {
  const floors = Math.max(0, range.toFloor - range.fromFloor + 1);
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Aralıq {idx + 1}
          {floors > 0 && (
            <span className="ml-2 text-primary font-normal normal-case">
              ({floors} mərtəbə · {floors * range.apartmentsPerFloor} mənzil)
            </span>
          )}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Baş. mərtəbə</label>
          <Input type="number" min={1} value={range.fromFloor} onChange={(e) => onChange({ ...range, fromFloor: +e.target.value })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Son mərtəbə</label>
          <Input type="number" min={1} value={range.toFloor} onChange={(e) => onChange({ ...range, toFloor: +e.target.value })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mənzil/mər.</label>
          <Input type="number" min={1} value={range.apartmentsPerFloor} onChange={(e) => onChange({ ...range, apartmentsPerFloor: +e.target.value })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sahə (m²)</label>
          <Input type="number" min={1} step={0.5} value={range.area} onChange={(e) => onChange({ ...range, area: +e.target.value })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-muted-foreground">Otaq sayı</label>
          <Input type="number" min={1} max={10} value={range.rooms} onChange={(e) => onChange({ ...range, rooms: +e.target.value })} className="h-7 text-xs" />
        </div>
      </div>
    </div>
  );
}

function BlockEditor({
  block, idx, canRemove, onChange, onRemove,
}: {
  block: BlockConfig; idx: number; canRemove: boolean;
  onChange: (b: BlockConfig) => void; onRemove: () => void;
}) {
  const totalApts = block.floorRanges.reduce((s, r) => s + Math.max(0, r.toFloor - r.fromFloor + 1) * r.apartmentsPerFloor, 0);
  const maxFloor = block.floorRanges.reduce((m, r) => Math.max(m, r.toFloor), 0);

  return (
    <div className="border border-border/50 rounded-xl p-3 space-y-2 bg-background/50">
      <div className="flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <Input
          value={block.name}
          onChange={(e) => onChange({ ...block, name: e.target.value })}
          placeholder={`Blok ${idx + 1} adı (məs. A bloku)`}
          className="h-7 text-xs flex-1"
        />
        {maxFloor > 0 && (
          <span className="text-xs text-primary font-medium whitespace-nowrap">{maxFloor}m · {totalApts}mən.</span>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80 flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="pl-5 space-y-2">
        {block.floorRanges.map((r, ri) => (
          <FloorRangeEditor
            key={ri} range={r} idx={ri}
            canRemove={block.floorRanges.length > 1}
            onChange={(updated) => {
              const ranges = [...block.floorRanges];
              ranges[ri] = updated;
              onChange({ ...block, floorRanges: ranges });
            }}
            onRemove={() => onChange({ ...block, floorRanges: block.floorRanges.filter((_, i) => i !== ri) })}
          />
        ))}
        <Button
          type="button" variant="ghost" size="sm"
          className="h-6 text-xs gap-1 px-2 w-full"
          onClick={() => onChange({ ...block, floorRanges: [...block.floorRanges, emptyRange()] })}
        >
          <Plus className="w-3 h-3" /> Mərtəbə aralığı əlavə et
        </Button>
      </div>
    </div>
  );
}

function BuildingEditor({
  building, qi, bi, onChange, onRemove, canRemove,
}: {
  building: BuildingConfig; qi: number; bi: number;
  onChange: (b: BuildingConfig) => void; onRemove: () => void; canRemove: boolean;
}) {
  const totalApts = building.blocks.reduce((bs, bl) =>
    bs + bl.floorRanges.reduce((s, r) => s + Math.max(0, r.toFloor - r.fromFloor + 1) * r.apartmentsPerFloor, 0), 0
  );

  return (
    <div className="border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/[0.02]">
      <div className="flex items-center gap-3">
        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
        <Input
          value={building.name}
          onChange={(e) => onChange({ ...building, name: e.target.value })}
          placeholder="Bina adı (məs. A, B, C-1)"
          className="h-8 text-sm flex-1 font-semibold"
        />
        {totalApts > 0 && (
          <span className="text-xs text-primary font-medium whitespace-nowrap">{totalApts} mənzil</span>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 pl-7">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Bloklar
          </span>
          <Button
            type="button" variant="ghost" size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => onChange({ ...building, blocks: [...building.blocks, emptyBlock()] })}
          >
            <Plus className="w-3 h-3" /> Blok əlavə et
          </Button>
        </div>
        {building.blocks.map((bl, bli) => (
          <BlockEditor
            key={bli} block={bl} idx={bli}
            canRemove={building.blocks.length > 1}
            onChange={(updated) => {
              const blocks = [...building.blocks];
              blocks[bli] = updated;
              onChange({ ...building, blocks });
            }}
            onRemove={() => onChange({ ...building, blocks: building.blocks.filter((_, i) => i !== bli) })}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminSetupPage() {
  const { isAdmin } = useAuth();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const [quarters, setQuarters] = useState<QuarterConfig[]>([
    { name: "A", description: "", buildings: [emptyBuilding()] },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Bu səhifəyə yalnız admin daxil ola bilər.</div>;
  }

  const addQuarter = () =>
    setQuarters((q) => [...q, { name: String.fromCharCode(65 + q.length), description: "", buildings: [emptyBuilding()] }]);

  const updateQuarter = (qi: number, field: keyof Omit<QuarterConfig, "buildings">, value: string) =>
    setQuarters((q) => q.map((item, i) => (i === qi ? { ...item, [field]: value } : item)));

  const updateBuilding = (qi: number, bi: number, updated: BuildingConfig) =>
    setQuarters((q) => q.map((item, i) =>
      i !== qi ? item : { ...item, buildings: item.buildings.map((b, j) => j === bi ? updated : b) }
    ));

  const totalApts = quarters.reduce(
    (s, q) => s + q.buildings.reduce(
      (bs, b) => bs + b.blocks.reduce(
        (bls, bl) => bls + bl.floorRanges.reduce((rs, r) => rs + Math.max(0, r.toFloor - r.fromFloor + 1) * r.apartmentsPerFloor, 0), 0
      ), 0
    ), 0
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
          Bütün kvartal, bina, blok və mənzillər sistemə əlavə edildi.
          İndi hər mənzilin sahəsini (m²) konfiqürasiya səhifəsindən tənzimləyə bilərsiniz.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => nav("/admin/configure")} className="w-full max-w-xs gap-2">
            Mənzil konfiqürasiyasına keç →
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => nav("/quarters")}>Kvartallar</Button>
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
          <p className="text-muted-foreground text-sm mt-1">Kvartal → Bina → Blok → Mərtəbə aralıqları toplu yaradın</p>
        </div>
        <Button onClick={addQuarter} variant="outline" className="gap-2">
          <PlusCircle className="w-4 h-4" /> Kvartal əlavə et
        </Button>
      </div>

      <div className="space-y-6">
        {quarters.map((q, qi) => (
          <Card key={qi} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {q.name || "?"}
                </div>
                <div className="flex-1 flex gap-3">
                  <Input
                    placeholder="Kvartal adı (A, B, C...)"
                    value={q.name}
                    onChange={(e) => updateQuarter(qi, "name", e.target.value)}
                    className="max-w-[160px] h-9 font-bold"
                  />
                  <Input
                    placeholder="Təsvir (ixtiyari)"
                    value={q.description}
                    onChange={(e) => updateQuarter(qi, "description", e.target.value)}
                    className="h-9"
                  />
                </div>
                {quarters.length > 1 && (
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => setQuarters((prev) => prev.filter((_, i) => i !== qi))}
                    className="text-destructive flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Binalar</div>
              {q.buildings.map((b, bi) => (
                <BuildingEditor
                  key={bi} building={b} qi={qi} bi={bi}
                  canRemove={q.buildings.length > 1}
                  onChange={(updated) => updateBuilding(qi, bi, updated)}
                  onRemove={() => setQuarters((prev) => prev.map((item, i) =>
                    i !== qi ? item : { ...item, buildings: item.buildings.filter((_, j) => j !== bi) }
                  ))}
                />
              ))}
              <Button
                size="sm" variant="outline"
                onClick={() => setQuarters((prev) => prev.map((item, i) =>
                  i !== qi ? item : { ...item, buildings: [...item.buildings, emptyBuilding()] }
                ))}
                className="gap-1 text-xs"
              >
                <Building2 className="w-3 h-3" /> Bina əlavə et
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {totalApts > 0 && (
          <div className="text-sm text-muted-foreground self-center">
            Cəmi <span className="font-bold text-foreground">{totalApts}</span> mənzil yaradılacaq
          </div>
        )}
        <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 px-8">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Quraşdır
        </Button>
      </div>
    </div>
  );
}
