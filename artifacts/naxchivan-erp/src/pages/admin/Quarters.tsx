import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Trash2, Building2, Home, ChevronDown, ChevronRight,
  Layers, Plus, X, GitBranch,
} from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface Quarter {
  id: number;
  name: string;
  description: string | null;
  buildingCount: number;
  apartmentCount: number;
}

interface BuildingBlock {
  id: number;
  name: string;
  floors: number;
  buildingId: number;
  apartmentCount: number;
}

interface Building {
  id: number;
  name: string;
  quarterId: number;
  quarterName: string | null;
  blockCount: number;
  apartmentCount: number;
  blocks: BuildingBlock[];
}

interface FloorRange {
  fromFloor: number;
  toFloor: number;
  apartmentsPerFloor: number;
  area: number;
  rooms: number;
}

interface BlockForm {
  name: string;
  floorRanges: FloorRange[];
}

interface BuildingForm {
  name: string;
  blocks: BlockForm[];
}

function emptyRange(): FloorRange {
  return { fromFloor: 1, toFloor: 1, apartmentsPerFloor: 4, area: 80, rooms: 2 };
}

function emptyBlock(): BlockForm {
  return { name: "", floorRanges: [emptyRange()] };
}

async function fetchQuarters(): Promise<Quarter[]> {
  const res = await fetch(`${BASE()}/api/quarters`);
  return res.json();
}

async function fetchBuildings(quarterId: number): Promise<Building[]> {
  const res = await fetch(`${BASE()}/api/buildings?quarterId=${quarterId}`);
  return res.json();
}

function FloorRangeRow({
  range,
  idx,
  onChange,
  onRemove,
  canRemove,
}: {
  range: FloorRange;
  idx: number;
  onChange: (r: FloorRange) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const totalFloors = range.toFloor - range.fromFloor + 1;
  const totalApts = totalFloors > 0 ? totalFloors * range.apartmentsPerFloor : 0;

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Aralıq {idx + 1}
          {totalFloors > 0 && (
            <span className="ml-2 text-primary font-normal normal-case">
              ({totalFloors} mərtəbə · {totalApts} mənzil)
            </span>
          )}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Başlanğıc mərtəbə</label>
          <Input
            type="number"
            min={1}
            value={range.fromFloor}
            onChange={(e) => onChange({ ...range, fromFloor: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Son mərtəbə</label>
          <Input
            type="number"
            min={range.fromFloor}
            value={range.toFloor}
            onChange={(e) => onChange({ ...range, toFloor: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mənzil / mərtəbə</label>
          <Input
            type="number"
            min={1}
            value={range.apartmentsPerFloor}
            onChange={(e) => onChange({ ...range, apartmentsPerFloor: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sahə (m²)</label>
          <Input
            type="number"
            min={1}
            step={0.5}
            value={range.area}
            onChange={(e) => onChange({ ...range, area: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-muted-foreground">Otaq sayı</label>
          <Input
            type="number"
            min={1}
            value={range.rooms}
            onChange={(e) => onChange({ ...range, rooms: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  idx,
  onChange,
  onRemove,
  canRemove,
}: {
  block: BlockForm;
  idx: number;
  onChange: (b: BlockForm) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const totalApts = block.floorRanges.reduce((s, r) => {
    const floors = r.toFloor - r.fromFloor + 1;
    return s + (floors > 0 ? floors * r.apartmentsPerFloor : 0);
  }, 0);
  const totalFloors = block.floorRanges.reduce((m, r) => Math.max(m, r.toFloor), 0);

  return (
    <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-background">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Blok adı</label>
          <Input
            value={block.name}
            onChange={(e) => onChange({ ...block, name: e.target.value })}
            placeholder="A bloku"
            className="h-8 text-sm"
          />
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80 mt-5">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {totalFloors > 0 && (
        <div className="text-xs text-muted-foreground flex gap-3">
          <span className="text-primary font-medium">{totalFloors} mərtəbə</span>
          <span>·</span>
          <span className="text-primary font-medium">{totalApts} mənzil</span>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mərtəbə aralıqları</label>
        {block.floorRanges.map((r, ri) => (
          <FloorRangeRow
            key={ri}
            range={r}
            idx={ri}
            canRemove={block.floorRanges.length > 1}
            onChange={(updated) => {
              const ranges = [...block.floorRanges];
              ranges[ri] = updated;
              onChange({ ...block, floorRanges: ranges });
            }}
            onRemove={() => {
              onChange({ ...block, floorRanges: block.floorRanges.filter((_, i) => i !== ri) });
            }}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 h-7 text-xs"
          onClick={() => onChange({ ...block, floorRanges: [...block.floorRanges, emptyRange()] })}
        >
          <Plus className="w-3 h-3" /> Aralıq əlavə et
        </Button>
      </div>
    </div>
  );
}

function BuildingRow({ building }: { building: Building }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Building2 className="w-4 h-4 text-primary" />
        <span className="font-medium flex-1">{building.name} Binası</span>
        <span className="text-sm text-muted-foreground">{building.blockCount} blok</span>
        <span className="text-sm text-muted-foreground ml-3">{building.apartmentCount} mənzil</span>
      </button>
      {expanded && building.blocks.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {building.blocks.map((bl) => (
            <div key={bl.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg bg-muted/20">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 font-medium">{bl.name}</span>
              <span className="text-muted-foreground">{bl.floors} mərtəbə</span>
              <span className="text-muted-foreground ml-3">{bl.apartmentCount} mənzil</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuarterCard({ quarter }: { quarter: Quarter }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [form, setForm] = useState<BuildingForm>({ name: "", blocks: [emptyBlock()] });

  const { data: buildings = [], isLoading } = useQuery<Building[]>({
    queryKey: ["buildings", quarter.id],
    queryFn: () => fetchBuildings(quarter.id),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`${BASE()}/api/quarters/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quarters"] }); toast({ title: "Kvartal silindi" }); },
  });

  const createBuildingMutation = useMutation({
    mutationFn: async (data: { quarterId: number; name: string; blocks: BlockForm[] }) => {
      const res = await fetch(`${BASE()}/api/admin/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarters: [{
            name: quarter.name,
            description: quarter.description,
            _existingQuarterId: data.quarterId,
            buildings: [{ name: data.name, blocks: data.blocks }],
          }],
        }),
      });
      if (!res.ok) throw new Error("Bina yaradılmadı");

      // Use the dedicated buildings endpoint to just create the building + blocks
      const buildRes = await fetch(`${BASE()}/api/admin/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterId: data.quarterId, name: data.name, blocks: data.blocks }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarters"] });
      qc.invalidateQueries({ queryKey: ["buildings", quarter.id] });
      setBuildingDialogOpen(false);
      setForm({ name: "", blocks: [emptyBlock()] });
      toast({ title: "Bina yaradıldı" });
    },
    onError: () => toast({ title: "Xəta", description: "Bina yaradılmadı", variant: "destructive" }),
  });

  const totalApts = form.blocks.reduce((bs, bl) =>
    bs + bl.floorRanges.reduce((s, r) => s + Math.max(0, r.toFloor - r.fromFloor + 1) * r.apartmentsPerFloor, 0), 0
  );

  function handleCreateBuilding() {
    if (!form.name.trim()) return;
    for (const bl of form.blocks) {
      if (!bl.name.trim()) { toast({ title: "Blok adını daxil edin", variant: "destructive" }); return; }
    }

    // Use the buildings API + admin/blocks for each block
    (async () => {
      const buildRes = await fetch(`${BASE()}/api/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterId: quarter.id, name: form.name }),
      });
      if (!buildRes.ok) { toast({ title: "Xəta", variant: "destructive" }); return; }
      const building = await buildRes.json();

      for (const bl of form.blocks) {
        await fetch(`${BASE()}/api/admin/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buildingId: building.id,
            quarterId: quarter.id,
            name: bl.name,
            floorRanges: bl.floorRanges,
          }),
        });
      }

      qc.invalidateQueries({ queryKey: ["quarters"] });
      qc.invalidateQueries({ queryKey: ["buildings", quarter.id] });
      setBuildingDialogOpen(false);
      setForm({ name: "", blocks: [emptyBlock()] });
      toast({ title: `${form.name} binası yaradıldı`, description: `${totalApts} mənzil sisteme əlavə edildi` });
    })();
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl">
              {quarter.name}
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(quarter.id)} className="text-destructive h-8 w-8">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          <h3 className="font-bold text-lg">{quarter.name} Kvartali</h3>
          {quarter.description && <p className="text-sm text-muted-foreground mt-1">{quarter.description}</p>}

          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              <span>{quarter.buildingCount} bina</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Home className="w-4 h-4" />
              <span>{quarter.apartmentCount} mənzil</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7 flex-1"
                onClick={() => { setExpanded((v) => !v); }}
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Binaları gör
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-7 flex-1"
                onClick={() => setBuildingDialogOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Yeni bina
              </Button>
            )}
          </div>

          {expanded && (
            <div className="mt-4 space-y-2">
              {isLoading ? (
                <div className="text-xs text-muted-foreground py-2 text-center">Yüklənir...</div>
              ) : buildings.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">Hələ bina yoxdur</div>
              ) : (
                buildings.map((b) => <BuildingRow key={b.id} building={b} />)
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Yeni Bina — {quarter.name} Kvartali
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bina adı</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="A"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">Məs: A, B, C-1, Şimali bina</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Bloklar
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => setForm((f) => ({ ...f, blocks: [...f.blocks, emptyBlock()] }))}
                >
                  <Plus className="w-3 h-3" /> Blok əlavə et
                </Button>
              </div>

              {form.blocks.map((bl, bi) => (
                <BlockEditor
                  key={bi}
                  block={bl}
                  idx={bi}
                  canRemove={form.blocks.length > 1}
                  onChange={(updated) => {
                    const blocks = [...form.blocks];
                    blocks[bi] = updated;
                    setForm((f) => ({ ...f, blocks }));
                  }}
                  onRemove={() => setForm((f) => ({ ...f, blocks: f.blocks.filter((_, i) => i !== bi) }))}
                />
              ))}
            </div>

            {totalApts > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary font-medium">
                Cəmi: {form.blocks.length} blok · {totalApts} mənzil yaradılacaq
              </div>
            )}

            <Button className="w-full" onClick={handleCreateBuilding} disabled={!form.name.trim()}>
              Bina yarat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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
      toast({ title: "Kvartal əlavə edildi" });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Kvartallar</h1>
          <p className="text-muted-foreground text-sm mt-1">Yaşayış kvartallarını və binalarını idarə edin</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <PlusCircle className="w-4 h-4" /> Yeni kvartal
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quarters.map((q) => (
          <QuarterCard key={q.id} quarter={q} />
        ))}
        {quarters.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            Hələ kvartal əlavə edilməyib
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Kvartal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ad</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="A, B, C..."
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
            <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name.trim()}>
              Əlavə et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
