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
  Layers, Plus, GitBranch, ShieldAlert, Eye, EyeOff, RefreshCw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ───────────────────────────────────────────────────────────────────

interface Quarter {
  id: number; name: string; description: string | null;
  buildingCount: number; apartmentCount: number;
}

interface BuildingBlock {
  id: number; name: string; floors: number;
  buildingId: number; apartmentCount: number;
}

interface Building {
  id: number; name: string; quarterId: number; quarterName: string | null;
  blockCount: number; apartmentCount: number; blocks: BuildingBlock[];
}

interface AptConfig { area: number; rooms: number; }

interface FloorRow {
  floor: number;
  apartments: AptConfig[];
}

interface BlockForm { name: string; totalFloors: number; floors: FloorRow[]; }
interface BuildingForm { name: string; blocks: BlockForm[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApt(area = 80, rooms = 2): AptConfig { return { area, rooms }; }

function makeFloors(count: number, apts = 4, area = 80, rooms = 2): FloorRow[] {
  return Array.from({ length: count }, (_, i) => ({
    floor: i + 1,
    apartments: Array.from({ length: apts }, () => makeApt(area, rooms)),
  }));
}

function emptyBlock(floors = 9): BlockForm {
  return { name: "", totalFloors: floors, floors: makeFloors(floors) };
}
function emptyBuilding(): BuildingForm { return { name: "", blocks: [emptyBlock()] }; }

async function fetchQuarters(): Promise<Quarter[]> {
  const res = await fetch(`${BASE()}/api/quarters`); return res.json();
}
async function fetchBuildings(quarterId: number): Promise<Building[]> {
  const res = await fetch(`${BASE()}/api/buildings?quarterId=${quarterId}`); return res.json();
}

// ─── FloorTable ──────────────────────────────────────────────────────────────

function FloorTable({ block, onChange }: { block: BlockForm; onChange: (b: BlockForm) => void }) {
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());
  const [defApts, setDefApts] = useState(4);
  const [defArea, setDefArea] = useState(80);
  const [defRooms, setDefRooms] = useState(2);

  const toggleFloor = (floor: number) =>
    setExpandedFloors((s) => { const n = new Set(s); n.has(floor) ? n.delete(floor) : n.add(floor); return n; });

  const totalApts = block.floors.reduce((s, f) => s + (f.apartments?.length ?? 0), 0);

  function applyDefaults() {
    onChange({
      ...block,
      floors: block.floors.map((f) => ({
        ...f,
        apartments: Array.from({ length: defApts }, () => makeApt(defArea, defRooms)),
      })),
    });
  }

  function handleTotalFloors(newCount: number) {
    if (newCount < 1 || newCount > 99) return;
    const existing = block.floors;
    let floors: FloorRow[];
    if (newCount > existing.length) {
      floors = [
        ...existing,
        ...Array.from({ length: newCount - existing.length }, (_, i) => ({
          floor: existing.length + i + 1,
          apartments: Array.from({ length: defApts }, () => makeApt(defArea, defRooms)),
        })),
      ];
    } else {
      floors = existing.slice(0, newCount);
    }
    onChange({ ...block, totalFloors: newCount, floors });
  }

  function updateApt(floorIdx: number, aptIdx: number, field: keyof AptConfig, val: number) {
    const floors = block.floors.map((f, fi) => {
      if (fi !== floorIdx) return f;
      return {
        ...f,
        apartments: (f.apartments ?? []).map((a, ai) => ai === aptIdx ? { ...a, [field]: val } : a),
      };
    });
    onChange({ ...block, floors });
  }

  function addApt(floorIdx: number) {
    const floors = block.floors.map((f, fi) =>
      fi === floorIdx ? { ...f, apartments: [...(f.apartments ?? []), makeApt(defArea, defRooms)] } : f
    );
    onChange({ ...block, floors });
  }

  function removeApt(floorIdx: number, aptIdx: number) {
    const floors = block.floors.map((f, fi) =>
      fi === floorIdx ? { ...f, apartments: (f.apartments ?? []).filter((_, ai) => ai !== aptIdx) } : f
    );
    onChange({ ...block, floors });
  }

  function applyToFloor(floorIdx: number) {
    const floors = block.floors.map((f, fi) =>
      fi === floorIdx ? { ...f, apartments: Array.from({ length: defApts }, () => makeApt(defArea, defRooms)) } : f
    );
    onChange({ ...block, floors });
  }

  return (
    <div className="space-y-3">
      {/* Defaults bar */}
      <div className="flex flex-wrap gap-2 items-end bg-muted/30 rounded-xl px-3 py-2.5">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Mərtəbə sayı</label>
          <Input type="number" min={1} max={99} value={block.totalFloors}
            onChange={(e) => handleTotalFloors(Number(e.target.value))}
            className="h-7 w-20 text-xs font-bold" />
        </div>
        <div className="w-px h-8 bg-border mx-1 self-center" />
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Dəf. mənzil sayı</label>
          <Input type="number" min={1} value={defApts} onChange={(e) => setDefApts(Number(e.target.value))}
            className="h-7 w-16 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Dəf. sahə (m²)</label>
          <Input type="number" min={1} step={0.01} value={defArea} onChange={(e) => setDefArea(Number(e.target.value))}
            className="h-7 w-20 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Dəf. otaq</label>
          <Input type="number" min={1} max={10} value={defRooms} onChange={(e) => setDefRooms(Number(e.target.value))}
            className="h-7 w-14 text-xs" />
        </div>
        <Button type="button" variant="outline" size="sm"
          className="h-7 gap-1.5 text-xs self-end" onClick={applyDefaults}>
          <RefreshCw className="w-3 h-3" /> Hamısına tətbiq et
        </Button>
        <div className="ml-auto self-end text-xs text-primary font-semibold">
          Cəmi: {totalApts} mənzil
        </div>
      </div>

      {/* Floor rows */}
      <div className="border border-border/50 rounded-xl overflow-hidden divide-y divide-border/30">
        {block.floors.map((f, fi) => {
          const isOpen = expandedFloors.has(f.floor);
          const aptCount = f.apartments?.length ?? 0;
          return (
            <div key={fi} className={cn("bg-background", fi % 2 === 0 ? "" : "bg-muted/10")}>
              {/* Floor header row */}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <button type="button" onClick={() => toggleFloor(f.floor)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <span className="text-xs font-bold text-muted-foreground w-6">{f.floor}</span>
                <span className="text-xs text-muted-foreground flex-1">
                  {aptCount} mənzil
                  {aptCount > 0 && (
                    <span className="ml-2 text-[11px] text-muted-foreground/60">
                      [{(f.apartments ?? []).map((a) => `${a.rooms}o/${a.area}m²`).join(" · ")}]
                    </span>
                  )}
                </span>
                <button type="button" onClick={() => applyToFloor(fi)}
                  className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors px-1"
                  title="Bu mərtəbəyə default dəyərləri tətbiq et">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {/* Expanded: per-apartment editor */}
              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-1.5 bg-primary/[0.02] border-t border-border/20">
                  <div className="grid grid-cols-[2rem_1fr_1.3fr_2rem] gap-1.5 text-[11px] text-muted-foreground font-semibold mb-1 px-1">
                    <span>#</span><span>Otaq</span><span>Sahə (m²)</span><span></span>
                  </div>
                  {(f.apartments ?? []).map((apt, ai) => (
                    <div key={ai} className="grid grid-cols-[2rem_1fr_1.3fr_2rem] gap-1.5 items-center">
                      <span className="text-xs font-bold text-primary">
                        {f.floor}{String(ai + 1).padStart(2, "0")}
                      </span>
                      <Input type="number" min={1} max={10} value={apt.rooms}
                        onChange={(e) => updateApt(fi, ai, "rooms", Number(e.target.value))}
                        className="h-6 text-xs px-1.5" />
                      <Input type="number" min={1} step={0.01} value={apt.area}
                        onChange={(e) => updateApt(fi, ai, "area", Number(e.target.value))}
                        className="h-6 text-xs px-1.5" />
                      {(f.apartments?.length ?? 0) > 1 ? (
                        <button type="button" onClick={() => removeApt(fi, ai)}
                          className="text-destructive hover:opacity-80">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm"
                    className="h-6 text-xs gap-1 px-2 w-full mt-1"
                    onClick={() => addApt(fi)}>
                    <Plus className="w-3 h-3" /> Mənzil əlavə et
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BlockEditor ─────────────────────────────────────────────────────────────

function BlockEditor({
  block, idx, canRemove, onChange, onRemove,
}: {
  block: BlockForm; idx: number; canRemove: boolean;
  onChange: (b: BlockForm) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(idx === 0);
  const totalApts = block.floors.reduce((s, f) => s + (f.apartments?.length ?? 0), 0);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <GitBranch className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="font-medium text-sm flex-1">{block.name || `Blok ${idx + 1}`}</span>
        {block.totalFloors > 0 && (
          <span className="text-xs text-muted-foreground">{block.totalFloors} mərtəbə · {totalApts} mənzil</span>
        )}
        {canRemove && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-destructive hover:opacity-80 ml-2 flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Blok adı</label>
            <Input value={block.name} onChange={(e) => onChange({ ...block, name: e.target.value })}
              placeholder={`Blok ${idx + 1} (məs. A bloku, Şimali blok)`}
              className="h-8 text-sm" />
          </div>
          <FloorTable block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ─── BuildingRow ──────────────────────────────────────────────────────────────

function BuildingRow({ building }: { building: Building }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}>
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

// ─── QuarterCard ─────────────────────────────────────────────────────────────

function QuarterCard({ quarter }: { quarter: Quarter }) {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<BuildingForm>(emptyBuilding());
  const [isCreating, setIsCreating] = useState(false);

  const { data: buildings = [], isLoading } = useQuery<Building[]>({
    queryKey: ["buildings", quarter.id],
    queryFn: () => fetchBuildings(quarter.id),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`${BASE()}/api/quarters/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user?.username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta baş verdi" }));
        throw new Error(err.error ?? "Silinmə uğursuz oldu");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarters"] });
      setDeleteDialogOpen(false);
      setDeletePassword("");
      toast({ title: `${quarter.name} kvartali silindi` });
    },
    onError: (e: Error) => toast({ title: "Xəta", description: e.message, variant: "destructive" }),
  });

  const totalNewApts = form.blocks.reduce((s, bl) =>
    s + bl.floors.reduce((fs, f) => fs + (f.apartments?.length ?? 0), 0), 0
  );

  async function handleCreateBuilding() {
    if (!form.name.trim()) { toast({ title: "Bina adını daxil edin", variant: "destructive" }); return; }
    for (const bl of form.blocks) {
      if (!bl.name.trim()) { toast({ title: "Blok adını daxil edin", variant: "destructive" }); return; }
    }
    setIsCreating(true);
    try {
      const buildRes = await fetch(`${BASE()}/api/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterId: quarter.id, name: form.name }),
      });
      if (!buildRes.ok) throw new Error("Bina yaradılmadı");
      const building = await buildRes.json();

      for (const bl of form.blocks) {
        // Send per-apartment floorConfig to backend
        const floorConfig = bl.floors.map((f) => ({
          floor: f.floor,
          apartments: f.apartments ?? [],
        }));
        const blockRes = await fetch(`${BASE()}/api/admin/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingId: building.id, quarterId: quarter.id, name: bl.name, floorConfig }),
        });
        if (!blockRes.ok) throw new Error(`${bl.name} yaradılmadı`);
      }

      qc.invalidateQueries({ queryKey: ["quarters"] });
      qc.invalidateQueries({ queryKey: ["buildings", quarter.id] });
      setBuildingDialogOpen(false);
      setForm(emptyBuilding());
      toast({ title: `${form.name} binası yaradıldı`, description: `${totalNewApts} mənzil əlavə edildi` });
    } catch (e: any) {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl">
              {quarter.name}
            </div>
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive h-8 w-8">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <h3 className="font-bold text-lg">{quarter.name} Kvartali</h3>
          {quarter.description && <p className="text-sm text-muted-foreground mt-1">{quarter.description}</p>}

          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /><span>{quarter.buildingCount} bina</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Home className="w-4 h-4" /><span>{quarter.apartmentCount} mənzil</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 flex-1"
              onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Binaları gör
            </Button>
            {isAdmin && (
              <Button size="sm" className="gap-1.5 text-xs h-7 flex-1"
                onClick={() => setBuildingDialogOpen(true)}>
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

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeletePassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Kvartali Sil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <strong>{quarter.name} Kvartali</strong> — {quarter.buildingCount} bina, {quarter.apartmentCount} mənzil
              silinəcək. Bu əməliyyat geri alına bilməz.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin şifrəsi ilə təsdiqlə</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && deletePassword && deleteMutation.mutate({ id: quarter.id, password: deletePassword })}
                  placeholder="Şifrəni daxil edin" className="pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1"
                onClick={() => { setDeleteDialogOpen(false); setDeletePassword(""); }}>
                Ləğv et
              </Button>
              <Button variant="destructive" className="flex-1"
                disabled={!deletePassword || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: quarter.id, password: deletePassword })}>
                {deleteMutation.isPending ? "Silinir..." : "Sil"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Building creation dialog */}
      <Dialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Yeni Bina — {quarter.name} Kvartali
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bina adı</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="A, B, C-1, Şimali bina..." className="text-base" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Bloklar
                </label>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                  onClick={() => setForm((f) => ({ ...f, blocks: [...f.blocks, emptyBlock()] }))}>
                  <Plus className="w-3 h-3" /> Blok əlavə et
                </Button>
              </div>

              {form.blocks.map((bl, bi) => (
                <BlockEditor key={bi} block={bl} idx={bi}
                  canRemove={form.blocks.length > 1}
                  onChange={(updated) => {
                    const blocks = [...form.blocks]; blocks[bi] = updated;
                    setForm((f) => ({ ...f, blocks }));
                  }}
                  onRemove={() => setForm((f) => ({ ...f, blocks: f.blocks.filter((_, i) => i !== bi) }))}
                />
              ))}
            </div>

            {totalNewApts > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary font-medium">
                Cəmi: {form.blocks.length} blok · {totalNewApts} mənzil yaradılacaq
              </div>
            )}

            <Button className="w-full" onClick={handleCreateBuilding}
              disabled={isCreating || !form.name.trim()}>
              {isCreating ? "Yaradılır..." : "Bina yarat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
          <p className="text-muted-foreground text-sm mt-1">
            Kvartal → Bina → Blok → Mərtəbə → Hər mənzilin öz sahəsi və otaq sayı
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <PlusCircle className="w-4 h-4" /> Yeni kvartal
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quarters.map((q) => <QuarterCard key={q.id} quarter={q} />)}
        {quarters.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            Hələ kvartal əlavə edilməyib. "Yeni kvartal" düyməsini sıxın.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Kvartal</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ad</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="A, B, C..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Təsvir (ixtiyari)</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Şimal bloku" />
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name.trim()}>
              Əlavə et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
