import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export type IdCardType = "yeni_nesil" | "kohne_nesil" | "myi" | "dyi" | "";

type GroupType = "yeni_nesil" | "kohne_nesil" | "residence" | "";

function typeToGroup(t: IdCardType): GroupType {
  if (t === "myi" || t === "dyi") return "residence";
  return t as GroupType;
}

function placeholder(t: IdCardType): string {
  if (t === "yeni_nesil") return "AA1234567";
  if (t === "kohne_nesil") return "AZE1234567";
  if (t === "myi") return "MYİ123456";
  if (t === "dyi") return "DYİ123456";
  return "";
}

interface Props {
  idCardType: IdCardType;
  idCardNumber: string;
  onTypeChange: (t: IdCardType) => void;
  onNumberChange: (n: string) => void;
}

export function IdCardInput({ idCardType, idCardNumber, onTypeChange, onNumberChange }: Props) {
  const group = typeToGroup(idCardType);

  function handleGroupChange(g: GroupType) {
    if (g === "yeni_nesil") onTypeChange("yeni_nesil");
    else if (g === "kohne_nesil") onTypeChange("kohne_nesil");
    else if (g === "residence") onTypeChange("myi");
    else onTypeChange("");
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Vəsiqənin növü</label>
        <Select value={group || "none"} onValueChange={v => handleGroupChange(v === "none" ? "" : v as GroupType)}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue placeholder="Seçin..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Seçilməyib —</SelectItem>
            <SelectItem value="yeni_nesil">Yeni nəsil şəxsiyyət vəsiqəsi</SelectItem>
            <SelectItem value="kohne_nesil">Köhnə nəsil şəxsiyyət vəsiqəsi</SelectItem>
            <SelectItem value="residence">Yaşamaq üçün icazə vəsiqəsi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {group === "residence" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">İcazə növü</label>
          <Select value={idCardType || "none"} onValueChange={v => onTypeChange(v === "none" ? "" : v as IdCardType)}>
            <SelectTrigger className="rounded-xl h-11">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="myi">MYİ — Müvəqqəti yaşamaq üçün icazə</SelectItem>
              <SelectItem value="dyi">DYİ — Daimi yaşamaq üçün icazə</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {idCardType && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Vəsiqənin nömrəsi</label>
          <Input
            value={idCardNumber}
            onChange={e => onNumberChange(e.target.value.toUpperCase())}
            className="rounded-xl h-11 font-mono"
            placeholder={placeholder(idCardType)}
          />
        </div>
      )}
    </div>
  );
}
