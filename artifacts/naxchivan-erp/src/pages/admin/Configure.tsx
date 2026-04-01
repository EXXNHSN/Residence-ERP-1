import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Home,
  Pencil,
  Check,
  X,
  RefreshCw,
  Layers,
} from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface Quarter {
  id: number;
  name: string;
  description: string | null;
  buildingCount: number;
  apartmentCount: number;
}

interface Block {
  id: number;
  name: string;
  quarterId: number | null;
  quarterName: string | null;
  floors: number;
  apartmentCount: number;
}

interface Apartment {
  id: number;
  blockId: number;
  blockName: string;
  number: string;
  floor: number;
  rooms: number;
  area: number;
  status: string;
  pricePerSqm: number;
  totalPrice: number;
}

function formatM2(v: number | string) {
  return `${Number(v).toFixed(1)} m²`;
}

function ApartmentCell({
  apt,
  onSave,
}: {
  apt: Apartment;
  onSave: (id: number, area: number, rooms: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [area, setArea] = useState(String(apt.area));
  const [rooms, setRooms] = useState(String(apt.rooms));

  const statusColors: Record<string, string> = {
    available: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600",
    sold: "bg-red-500/15 border-red-500/30 text-red-600",
    reserved: "bg-amber-500/15 border-amber-500/30 text-amber-600",
  };
  const statusLabels: Record<string, string> = {
    available: "Boş",
    sold: "Satılıb",
    reserved: "Rezerv",
  };

  const save = () => {
    onSave(apt.id, Number(area), Number(rooms));
    setEditing(false);
  };

  const cancel = () => {
    setArea(String(apt.area));
    setRooms(String(apt.rooms));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border-2 border-primary rounded-lg p-2 bg-primary/5 min-w-[130px]">
        <div className="text-xs font-bold text-center text-primary mb-1.5">№ {apt.number}</div>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs text-muted-foreground w-8">m²:</span>
          <Input
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-6 text-xs px-1.5 w-full"
            step="0.5"
            min="1"
          />
        </div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-muted-foreground w-8">otaq:</span>
          <Input
            type="number"
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            className="h-6 text-xs px-1.5 w-full"
            min="1"
            max="10"
          />
        </div>
        <div className="flex gap-1">
          <Button size="icon" className="h-6 w-full" onClick={save}>
            <Check className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-full" onClick={cancel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`group border rounded-lg p-2 text-left transition-all hover:border-primary hover:shadow-md hover:shadow-primary/10 min-w-[110px] relative ${statusColors[apt.status] ?? ""}`}
    >
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="w-2.5 h-2.5 text-primary" />
      </div>
      <div className="text-xs font-bold mb-0.5">№ {apt.number}</div>
      <div className="text-xs font-semibold">{formatM2(apt.area)}</div>
      <div className="text-xs text-muted-foreground">{apt.rooms} otaq</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {statusLabels[apt.status] ?? apt.status}
      </div>
    </button>
  );
}

function FloorRow({
  floor,
  apts,
  onSave,
}: {
  floor: number;
  apts: Apartment[];
  onSave: (id: number, area: number, rooms: number) => void;
}) {
  const [bulkArea, setBulkArea] = useState("");
  const [bulkRooms, setBulkRooms] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const applyBulk = () => {
    apts.forEach((a) => {
      onSave(a.id, Number(bulkArea) || a.area, Number(bulkRooms) || a.rooms);
    });
    setShowBulk(false);
    setBulkArea("");
    setBulkRooms("");
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-1 min-w-[80px] pt-2">
        <Layers className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground">{floor}. mərtəbə</span>
      </div>

      <div className="flex flex-wrap gap-2 flex-1">
        {apts.sort((a, b) => a.number.localeCompare(b.number)).map((apt) => (
          <ApartmentCell key={apt.id} apt={apt} onSave={onSave} />
        ))}
      </div>

      <div className="pt-1 flex-shrink-0">
        {showBulk ? (
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-2">
            <Input
              type="number"
              placeholder="m²"
              value={bulkArea}
              onChange={(e) => setBulkArea(e.target.value)}
              className="h-7 w-16 text-xs"
            />
            <Input
              type="number"
              placeholder="otaq"
              value={bulkRooms}
              onChange={(e) => setBulkRooms(e.target.value)}
              className="h-7 w-14 text-xs"
            />
            <Button size="icon" className="h-7 w-7" onClick={applyBulk}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowBulk(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowBulk(true)}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Hamısını dəyiş
          </Button>
        )}
      </div>
    </div>
  );
}

function BuildingSection({
  block,
  allApts,
  onSave,
}: {
  block: Block;
  allApts: Apartment[];
  onSave: (id: number, area: number, rooms: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const blockApts = allApts.filter((a) => a.blockId === block.id);

  const floors = [...new Set(blockApts.map((a) => a.floor))].sort((a, b) => b - a);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-semibold">{block.name}</span>
        <Badge variant="outline" className="ml-auto text-xs">
          {blockApts.length} mənzil · {floors.length} mərtəbə
        </Badge>
      </button>

      {expanded && (
        <div className="px-4 py-2 divide-y divide-border/30">
          {floors.map((floor) => (
            <FloorRow
              key={floor}
              floor={floor}
              apts={blockApts.filter((a) => a.floor === floor)}
              onSave={onSave}
            />
          ))}
          {floors.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Bu binada mənzil yoxdur</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConfigurePage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: quarters = [] } = useQuery<Quarter[]>({
    queryKey: ["quarters"],
    queryFn: () => fetch(`${BASE()}/api/quarters`).then((r) => r.json()),
  });

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ["blocks"],
    queryFn: () => fetch(`${BASE()}/api/blocks`).then((r) => r.json()),
  });

  const { data: apts = [] } = useQuery<Apartment[]>({
    queryKey: ["apartments-all"],
    queryFn: () => fetch(`${BASE()}/api/apartments`).then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, area, rooms }: { id: number; area: number; rooms: number }) => {
      const res = await fetch(`${BASE()}/api/apartments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, rooms }),
      });
      if (!res.ok) throw new Error("Güncəlləmə uğursuz oldu");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apartments-all"] });
    },
    onError: (e: any) => {
      toast({ title: "Xəta", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = useCallback(
    (id: number, area: number, rooms: number) => {
      updateMutation.mutate({ id, area, rooms });
    },
    [updateMutation]
  );

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">Bu səhifəyə yalnız admin daxil ola bilər.</div>
    );
  }

  const ungroupedBlocks = blocks.filter((b) => !b.quarterId);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold">Mənzil Konfiqürasiyası</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hər mənzilin sahəsini (m²), otaq sayını redaktə edin. Mərtəbə üzrə toplu dəyişiklik edə bilərsiniz.
        </p>
      </div>

      {quarters.map((q) => {
        const qBlocks = blocks.filter((b) => b.quarterId === q.id);
        if (qBlocks.length === 0) return null;
        return (
          <div key={q.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {q.name}
              </div>
              <h2 className="text-lg font-bold">{q.name} Məhəlləsi</h2>
              {q.description && (
                <span className="text-sm text-muted-foreground">— {q.description}</span>
              )}
              <Badge variant="secondary" className="ml-auto">
                <MapPin className="w-3 h-3 mr-1" />
                {qBlocks.length} bina · {q.apartmentCount} mənzil
              </Badge>
            </div>
            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              {qBlocks.map((b) => (
                <BuildingSection key={b.id} block={b} allApts={apts} onSave={handleSave} />
              ))}
            </div>
          </div>
        );
      })}

      {ungroupedBlocks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-muted-foreground">Məhəlləsiz binalar</h2>
          <div className="space-y-3">
            {ungroupedBlocks.map((b) => (
              <BuildingSection key={b.id} block={b} allApts={apts} onSave={handleSave} />
            ))}
          </div>
        </div>
      )}

      {quarters.length === 0 && blocks.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Hələ heç bir məhəllə və ya bina əlavə edilməyib</p>
          <p className="text-sm mt-1">Əvvəlcə "Layihə quraşdırması" səhifəsindən strukturu yaradın</p>
        </div>
      )}
    </div>
  );
}
