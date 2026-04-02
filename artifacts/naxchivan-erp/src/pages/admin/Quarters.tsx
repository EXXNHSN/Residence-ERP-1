import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Trash2, Building2, Home, ChevronDown, ChevronRight,
  Layers, Plus, GitBranch, ShieldAlert, Eye, EyeOff, RefreshCw, X, Pencil, Settings2, Loader2,
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

interface AptConfig { id?: number; number: string; area: number; rooms: number; }

interface FloorRow {
  floor: number;
  apartments: AptConfig[];
}

interface BlockForm { name: string; totalFloors: number; startFloor: number; floors: FloorRow[]; }
interface BuildingForm { name: string; blocks: BlockForm[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApt(area = 80, rooms = 2): AptConfig { return { number: "", area, rooms }; }

function makeFloors(count: number, startFloor = 2, apts = 4, area = 80, rooms = 2): FloorRow[] {
  return Array.from({ length: count }, (_, i) => ({
    floor: startFloor + i,
    apartments: Array.from({ length: apts }, () => makeApt(area, rooms)),
  }));
}

function emptyBlock(floors = 9): BlockForm {
  return { name: "", totalFloors: floors, startFloor: 2, floors: makeFloors(floors, 2) };
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

  // Regenerate all floors using current startFloor
  function rebuildFloors(totalFloors: number, startFloor: number) {
    const existing = block.floors;
    return Array.from({ length: totalFloors }, (_, i) => {
      const floorNum = startFloor + i;
      const prev = existing.find((f) => f.floor === floorNum);
      return prev ?? {
        floor: floorNum,
        apartments: Array.from({ length: defApts }, () => makeApt(defArea, defRooms)),
      };
    });
  }

  function handleTotalFloors(newCount: number) {
    if (newCount < 1 || newCount > 99) return;
    onChange({ ...block, totalFloors: newCount, floors: rebuildFloors(newCount, block.startFloor) });
  }

  function handleStartFloor(newStart: number) {
    if (newStart < 1 || newStart > 99) return;
    onChange({ ...block, startFloor: newStart, floors: rebuildFloors(block.totalFloors, newStart) });
  }

  function applyDefaults() {
    onChange({
      ...block,
      floors: block.floors.map((f) => ({
        ...f,
        apartments: Array.from({ length: defApts }, () => makeApt(defArea, defRooms)),
      })),
    });
  }

  function updateAptNumber(floorIdx: number, aptIdx: number, val: string) {
    const floors = block.floors.map((f, fi) => {
      if (fi !== floorIdx) return f;
      return { ...f, apartments: (f.apartments ?? []).map((a, ai) => ai === aptIdx ? { ...a, number: val } : a) };
    });
    onChange({ ...block, floors });
  }

  function updateAptField(floorIdx: number, aptIdx: number, field: "area" | "rooms", val: number) {
    const floors = block.floors.map((f, fi) => {
      if (fi !== floorIdx) return f;
      return { ...f, apartments: (f.apartments ?? []).map((a, ai) => ai === aptIdx ? { ...a, [field]: val } : a) };
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
          <label className="text-[11px] text-muted-foreground font-medium">Başlanğıc mərtəbə</label>
          <Input type="number" min={1} max={99} value={block.startFloor}
            onChange={(e) => handleStartFloor(Number(e.target.value))}
            className="h-7 w-16 text-xs font-bold" />
        </div>
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

      {block.floors.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          Mərtəbə aralığı: <strong>{block.floors[0].floor}</strong> – <strong>{block.floors[block.floors.length - 1].floor}</strong>
          {" "}· Hər mərtəbənin üzərinə klik edib mənzil nömrəsini, otaq sayını və sahəsini ayrıca daxil edin.
        </p>
      )}

      {/* Floor rows */}
      <div className="border border-border/50 rounded-xl overflow-hidden divide-y divide-border/30">
        {block.floors.map((f, fi) => {
          const isOpen = expandedFloors.has(f.floor);
          const aptCount = f.apartments?.length ?? 0;
          const filledNums = (f.apartments ?? []).filter((a) => a.number.trim()).map((a) => a.number);
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
                  {filledNums.length > 0 && (
                    <span className="ml-2 text-[11px] text-primary/70 font-medium">
                      [{filledNums.join(", ")}]
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
                  <div className="grid grid-cols-[1.5fr_0.7fr_1.3fr_2rem] gap-1.5 text-[11px] text-muted-foreground font-semibold mb-1 px-1">
                    <span>Mənzil №</span><span>Otaq</span><span>Sahə (m²)</span><span></span>
                  </div>
                  {(f.apartments ?? []).map((apt, ai) => (
                    <div key={ai} className="grid grid-cols-[1.5fr_0.7fr_1.3fr_2rem] gap-1.5 items-center">
                      <Input
                        value={apt.number}
                        onChange={(e) => updateAptNumber(fi, ai, e.target.value)}
                        placeholder={`məs. ${f.floor}0${ai + 1}`}
                        className="h-6 text-xs px-1.5 font-mono"
                      />
                      <Input type="number" min={1} max={10} value={apt.rooms}
                        onChange={(e) => updateAptField(fi, ai, "rooms", Number(e.target.value))}
                        className="h-6 text-xs px-1.5" />
                      <Input type="number" min={1} step={0.01} value={apt.area}
                        onChange={(e) => updateAptField(fi, ai, "area", Number(e.target.value))}
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

// ─── BlockReconfigureDialog ───────────────────────────────────────────────────

function BlockReconfigureDialog({
  block, username, open, onClose, onRefresh,
}: {
  block: BuildingBlock;
  username: string;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm | null>(null);
  const [soldNums, setSoldNums] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!open) { setAdminPassword(""); setPwError(null); return; }
    setBlockForm(null);
    fetch(`${BASE()}/api/apartments?blockId=${block.id}`)
      .then((r) => r.json())
      .then((apts: any[]) => {
        const floorMap: Record<number, AptConfig[]> = {};
        const sold: string[] = [];
        for (const apt of apts) {
          const fl = apt.floor ?? 1;
          if (!floorMap[fl]) floorMap[fl] = [];
          floorMap[fl].push({ id: apt.id, number: apt.number, area: Number(apt.area), rooms: apt.rooms });
          if (apt.status !== "available") sold.push(apt.number);
        }
        const floors: FloorRow[] = Object.keys(floorMap)
          .map(Number).sort((a, b) => a - b)
          .map((fl) => ({ floor: fl, apartments: floorMap[fl] }));
        const minFloor = floors.length > 0 ? floors[0].floor : 2;
        const totalFloors = floors.length > 0 ? floors[floors.length - 1].floor - minFloor + 1 : block.floors;
        setSoldNums(sold);
        setBlockForm({ name: block.name, totalFloors, startFloor: minFloor, floors });
      });
  }, [open, block.id]);

  async function handleSave() {
    if (!blockForm) return;
    if (!adminPassword.trim()) { setPwError("Admin şifrəsi tələb olunur"); return; }
    setSaving(true);
    setPwError(null);
    try {
      const floorConfig = blockForm.floors.map((f) => ({
        floor: f.floor,
        apartments: f.apartments.map((a) => ({ id: a.id, number: a.number, area: a.area, rooms: a.rooms })),
      }));
      const res = await fetch(`${BASE()}/api/admin/blocks/${block.id}/reconfigure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: adminPassword.trim(), floorConfig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Xəta" }));
        setPwError(err.error ?? "Xəta baş verdi");
        return;
      }
      const result = await res.json();
      toast({ title: `${block.name} yeniləndi`, description: `${result.floorCount} mərtəbə · ${result.apartmentCount} mənzil` });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            {block.name} — Mərtəbə / Mənzil Redaktəsi
          </DialogTitle>
        </DialogHeader>

        {!blockForm ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            {soldNums.length > 0 && (
              <div className="text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2 border border-amber-200">
                Satılmış / qeyd edilmiş mənzillər silinə bilməz: <strong>{soldNums.join(", ")}</strong>
              </div>
            )}

            <FloorTable block={blockForm} onChange={setBlockForm} />

            {/* Admin password */}
            <div className="border-t border-border/40 pt-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Admin şifrəsi ilə təsdiqlə
              </label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setPwError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Şifrəni daxil edin"
                  className="pr-10 rounded-xl h-10"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
                Ləğv et
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving || !adminPassword}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saxlanılır...</> : "Yadda Saxla"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── BuildingRow ──────────────────────────────────────────────────────────────

function BuildingRow({ building, isAdmin, username, onRefresh }: {
  building: Building;
  isAdmin: boolean;
  username: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const [editBuildingOpen, setEditBuildingOpen] = useState(false);
  const [editBuildingName, setEditBuildingName] = useState(building.name);

  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BuildingBlock | null>(null);
  const [editBlockName, setEditBlockName] = useState("");

  const [reconfigBlock, setReconfigBlock] = useState<BuildingBlock | null>(null);

  async function handleSaveBuilding(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/buildings/${building.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: adminPassword, name: editBuildingName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `${editBuildingName} binasının adı yeniləndi` });
    onRefresh();
  }

  async function handleSaveBlock(adminPassword: string) {
    if (!editingBlock) return;
    const res = await fetch(`${BASE()}/api/blocks/${editingBlock.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: adminPassword, name: editBlockName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `${editBlockName} blokun adı yeniləndi` });
    onRefresh();
  }

  return (
    <>
      {/* Building row */}
      <div className={cn("bg-background", expanded && "bg-muted/10")}>
        <div className="flex items-center gap-2 px-5 py-3 hover:bg-muted/30 transition-colors">
          <button type="button" className="flex items-center gap-2.5 flex-1 text-left min-w-0"
            onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="font-medium text-sm text-foreground flex-1 truncate">{building.name} Binası</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{building.blockCount} blok</span>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-3">{building.apartmentCount} mənzil</span>
          </button>
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditBuildingName(building.name); setEditBuildingOpen(true); }}
              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ml-1 flex-shrink-0">
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        {expanded && building.blocks.length > 0 && (
          <div className="pb-2">
            {building.blocks.map((bl) => (
              <div key={bl.id} className="flex items-center gap-2 py-2 pl-12 pr-5 hover:bg-muted/20 transition-colors">
                <GitBranch className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-foreground/80 truncate">{bl.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{bl.floors} mərtəbə</span>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-3">{bl.apartmentCount} mənzil</span>
                {isAdmin && (
                  <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingBlock(bl); setEditBlockName(bl.name); setEditBlockOpen(true); }}
                      className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Blokun adını dəyiş">
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setReconfigBlock(bl)}
                      className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Mərtəbə/mənzil redaktəsi">
                      <Settings2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminEditDialog open={editBuildingOpen} onClose={() => setEditBuildingOpen(false)}
        title="Binanı Redaktə et" onSave={handleSaveBuilding}>
        <div className="space-y-2">
          <label className="text-sm font-medium">Bina adı</label>
          <Input value={editBuildingName} onChange={(e) => setEditBuildingName(e.target.value)}
            className="rounded-xl h-11" placeholder="Bina adı..." />
        </div>
      </AdminEditDialog>

      <AdminEditDialog open={editBlockOpen} onClose={() => setEditBlockOpen(false)}
        title="Bloku Redaktə et" onSave={handleSaveBlock}>
        <div className="space-y-2">
          <label className="text-sm font-medium">Blok adı</label>
          <Input value={editBlockName} onChange={(e) => setEditBlockName(e.target.value)}
            className="rounded-xl h-11" placeholder="Blok adı..." />
        </div>
      </AdminEditDialog>

      {reconfigBlock && (
        <BlockReconfigureDialog
          block={reconfigBlock}
          username={username}
          open={!!reconfigBlock}
          onClose={() => setReconfigBlock(null)}
          onRefresh={() => { setReconfigBlock(null); onRefresh(); }}
        />
      )}
    </>
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
  const [editQuarterOpen, setEditQuarterOpen] = useState(false);
  const [editName, setEditName] = useState(quarter.name);
  const [editDesc, setEditDesc] = useState(quarter.description ?? "");

  async function handleSaveQuarter(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/quarters/${quarter.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword, name: editName, description: editDesc }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `${editName} kvartalı yeniləndi` });
    qc.invalidateQueries({ queryKey: ["quarters"] });
  }

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
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-foreground leading-tight truncate">
                {quarter.name} Kvartali
              </h3>
              {quarter.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{quarter.description}</p>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                <button
                  onClick={() => { setEditName(quarter.name); setEditDesc(quarter.description ?? ""); setEditQuarterOpen(true); }}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5" />{quarter.buildingCount} bina
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-1">
              <Home className="w-3.5 h-3.5" />{quarter.apartmentCount} mənzil
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border/50 px-4 py-2.5 bg-muted/20 flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex-1">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-primary" />
              : <ChevronRight className="w-3.5 h-3.5" />}
            <span className={cn("transition-colors", expanded && "text-primary")}>Binaları gör</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setBuildingDialogOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Yeni bina
            </button>
          )}
        </div>

        {/* Expanded buildings list */}
        {expanded && (
          <div className="border-t border-border/40">
            {isLoading ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Yüklənir...</div>
            ) : buildings.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Hələ bina yoxdur</div>
            ) : (
              <div className="divide-y divide-border/40">
                {buildings.map((b) => (
                  <BuildingRow key={b.id} building={b}
                    isAdmin={isAdmin}
                    username={user?.username ?? ""}
                    onRefresh={() => qc.invalidateQueries({ queryKey: ["buildings", quarter.id] })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

      <AdminEditDialog open={editQuarterOpen} onClose={() => setEditQuarterOpen(false)}
        title="Kvartali Redaktə et" onSave={handleSaveQuarter}>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Kvartal adı</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl h-11" placeholder="A, B, C..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Təsvir (ixtiyari)</label>
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              className="rounded-xl h-11" placeholder="Şimal bloku..." />
          </div>
        </div>
      </AdminEditDialog>
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
