import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Loader2, ArrowRight, Banknote, FileDown, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { az } from "date-fns/locale";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");
const formatAZN = (n: number) =>
  new Intl.NumberFormat("az-AZ", { style: "currency", currency: "AZN", minimumFractionDigits: 2 }).format(n);

type ParsedRow = {
  rowNumber: number;
  qaimeNumber: string;
  amount: number;
  paymentDate?: string;
};

type PreviewRow = ParsedRow & {
  matched: boolean;
  status: "ready" | "not_found" | "duplicate" | "cash_sale" | "fully_paid" | "error";
  message: string;
  saleId?: number;
  customerId?: number;
  customerName?: string;
  assetDescription?: string;
  currentBalance?: number;
  willApply?: number;
  overpayment?: number;
};

type PreviewResult = {
  rows: PreviewRow[];
  summary: {
    total: number;
    matched: number;
    errors: number;
    totalAmount: number;
    willApplyTotal: number;
  };
};

const STATUS_META: Record<PreviewRow["status"], { color: string; bg: string; label: string; icon: any }> = {
  ready: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Hazır", icon: CheckCircle2 },
  not_found: { color: "text-rose-700", bg: "bg-rose-50 border-rose-200", label: "Tapılmadı", icon: XCircle },
  duplicate: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Dublikat", icon: AlertCircle },
  cash_sale: { color: "text-slate-600", bg: "bg-slate-50 border-slate-200", label: "Nağd satış", icon: AlertCircle },
  fully_paid: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "Tam ödənilib", icon: CheckCircle2 },
  error: { color: "text-rose-700", bg: "bg-rose-50 border-rose-200", label: "Xəta", icon: XCircle },
};

export default function BankImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");

  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [qaimeCol, setQaimeCol] = useState<string>("");
  const [amountCol, setAmountCol] = useState<string>("");
  const [dateCol, setDateCol] = useState<string>("__none__");
  const [defaultDate, setDefaultDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);

  // Auto-detect column names
  function autoDetect(cols: string[]) {
    const lower = cols.map((c) => String(c).toLowerCase());
    const findIdx = (...keywords: string[]) =>
      lower.findIndex((c) => keywords.some((k) => c.includes(k)));

    const qIdx = findIdx("qaim", "hesab", "invoice", "şifr", "kod");
    const aIdx = findIdx("məbləğ", "mebleg", "amount", "sum", "ödən", "oden");
    const dIdx = findIdx("tarix", "date");

    return {
      qaime: qIdx >= 0 ? cols[qIdx] : "",
      amount: aIdx >= 0 ? cols[aIdx] : "",
      date: dIdx >= 0 ? cols[dIdx] : "__none__",
    };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

        if (json.length === 0) {
          toast({ title: "Excel boşdur", description: "Faylda heç bir məlumat yoxdur.", variant: "destructive" });
          return;
        }

        const cols = Object.keys(json[0]);
        const detected = autoDetect(cols);

        setHeaders(cols);
        setRawRows(json);
        setQaimeCol(detected.qaime);
        setAmountCol(detected.amount);
        setDateCol(detected.date);
        setStep("map");
      } catch (err: any) {
        toast({ title: "Excel oxunmadı", description: err?.message ?? "Naməlum xəta", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseAmount(v: any): number {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const s = String(v).replace(/[^\d.,-]/g, "").replace(/\s/g, "");
    // Support both 1,234.56 and 1.234,56 styles. Heuristic: last separator = decimal
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    let normalized = s;
    if (lastDot > lastComma) normalized = s.replace(/,/g, "");
    else if (lastComma > lastDot) normalized = s.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return isNaN(n) ? 0 : n;
  }

  function parseDate(v: any): string | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v.toISOString();
    const s = String(v).trim();
    // Try DD.MM.YYYY or DD/MM/YYYY
    const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const dt = new Date(year, Number(mo) - 1, Number(d));
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? undefined : dt.toISOString();
  }

  async function handlePreview() {
    if (!qaimeCol || !amountCol) {
      toast({ title: "Sütunlar seçilməyib", description: "Qaimə və məbləğ sütunlarını seçin.", variant: "destructive" });
      return;
    }

    const rows: ParsedRow[] = rawRows.map((r, idx) => {
      const qaimeRaw = String(r[qaimeCol] ?? "").trim();
      const amount = parseAmount(r[amountCol]);
      const dateStr = dateCol && dateCol !== "__none__" ? parseDate(r[dateCol]) : undefined;
      return {
        rowNumber: idx + 2, // +2 because row 1 is header
        qaimeNumber: qaimeRaw,
        amount,
        paymentDate: dateStr ?? new Date(defaultDate).toISOString(),
      };
    }).filter((r) => r.qaimeNumber || r.amount > 0);

    setParsedRows(rows);
    setIsLoading(true);

    try {
      const token = sessionStorage.getItem("naxchivan_erp_token");
      const res = await fetch(`${BASE()}/api/bank-import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Xəta ${res.status}`);
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Önbaxış alınmadı", description: err?.message ?? "Naməlum xəta", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    const matched = preview.rows.filter((r) => r.matched && r.saleId);
    if (matched.length === 0) {
      toast({ title: "Tətbiq ediləcək sətir yoxdur", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const payments = matched.map((r) => ({
        saleId: r.saleId!,
        amount: r.amount,
        paymentDate: r.paymentDate,
        qaimeNumber: r.qaimeNumber,
      }));

      const token = sessionStorage.getItem("naxchivan_erp_token");
      const res = await fetch(`${BASE()}/api/bank-import/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Xəta ${res.status}`);
      }
      const data = await res.json();
      setApplyResult(data);
      setStep("done");
      toast({
        title: "Ödənişlər tətbiq edildi",
        description: `${data.summary.successCount} sətir uğurlu, cəmi ${formatAZN(data.summary.totalApplied)}`,
      });
    } catch (err: any) {
      toast({ title: "Tətbiq edilmədi", description: err?.message ?? "Naməlum xəta", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setQaimeCol("");
    setAmountCol("");
    setDateCol("__none__");
    setParsedRows([]);
    setPreview(null);
    setApplyResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadUnmatched() {
    if (!preview) return;
    const unmatched = preview.rows.filter((r) => !r.matched);
    if (unmatched.length === 0) return;
    const data = unmatched.map((r) => ({
      "Sətir": r.rowNumber,
      "Qaimə №": r.qaimeNumber,
      "Məbləğ": r.amount,
      "Status": STATUS_META[r.status].label,
      "Səbəb": r.message,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tutuşmayan");
    XLSX.writeFile(wb, `tutushmayan-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Banknote className="w-6 h-6 text-white" />
            </div>
            Bank İdxalı
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bankdan gələn aylıq ödəniş cədvəlini yükləyin — sistem qaimə nömrələrinə görə ödənişləri avtomatik tutuşduracaq
          </p>
        </div>
        {step !== "upload" && (
          <Button variant="outline" onClick={reset} className="gap-2">
            <Trash2 className="w-4 h-4" /> Yenidən başla
          </Button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "upload", label: "1. Excel yüklə" },
          { key: "map", label: "2. Sütunları təyin et" },
          { key: "preview", label: "3. Önbaxış" },
          { key: "done", label: "4. Tamam" },
        ].map((s, i, arr) => {
          const order = ["upload", "map", "preview", "done"];
          const cur = order.indexOf(step);
          const idx = order.indexOf(s.key);
          const active = idx === cur;
          const done = idx < cur;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                  active
                    ? "bg-primary text-white border-primary"
                    : done
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {s.label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: UPLOAD */}
      {step === "upload" && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-200">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Bank Excel faylını seçin</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Dəstəklənən formatlar: .xlsx, .xls, .csv
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} size="lg" className="gap-2">
                <Upload className="w-4 h-4" /> Fayl seç
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />

              <div className="mt-6 max-w-lg text-left bg-white rounded-xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-700">Necə işləyir:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Hər satışın bir <strong>qaimə nömrəsi</strong> olur — bunu satış formasında doldurun</li>
                  <li>Bank Excel-də qaimə № və məbləğ sütunlarını seçin</li>
                  <li>Sistem ödənişləri qaimə nömrəsinə görə tapacaq</li>
                  <li>Hər ödəniş satışın taksit qrafikinə görə paylanacaq</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: MAP COLUMNS */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> {fileName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{rawRows.length} sətir tapıldı. İndi sütunları təyin edin:</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Qaimə Nömrəsi sütunu *</Label>
                <Select value={qaimeCol} onValueChange={setQaimeCol}>
                  <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Məbləğ sütunu *</Label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ödəniş Tarixi sütunu (ixtiyari)</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger><SelectValue placeholder="Yoxdur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Yoxdur (defolt istifadə et) —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(!dateCol || dateCol === "__none__") && (
              <div className="space-y-2 max-w-xs">
                <Label>Defolt Ödəniş Tarixi</Label>
                <Input type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} />
              </div>
            )}

            {/* Sample preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">İlk 5 sətir nümunə</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                          h === qaimeCol ? "bg-emerald-100 text-emerald-800" :
                          h === amountCol ? "bg-blue-100 text-blue-800" :
                          h === dateCol ? "bg-amber-100 text-amber-800" : ""
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {headers.map((h) => (
                          <td key={h} className={`px-3 py-2 whitespace-nowrap ${
                            h === qaimeCol ? "bg-emerald-50 font-mono font-semibold" :
                            h === amountCol ? "bg-blue-50 font-semibold" :
                            h === dateCol ? "bg-amber-50" : ""
                          }`}>{String(r[h] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={reset}>Ləğv</Button>
              <Button onClick={handlePreview} disabled={isLoading || !qaimeCol || !amountCol} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Önbaxış
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: PREVIEW */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Cəmi sətir</div>
              <div className="text-2xl font-bold">{preview.summary.total}</div>
            </CardContent></Card>
            <Card className="bg-emerald-50/50 border-emerald-200"><CardContent className="p-4">
              <div className="text-xs text-emerald-700">Tutuşan</div>
              <div className="text-2xl font-bold text-emerald-700">{preview.summary.matched}</div>
            </CardContent></Card>
            <Card className="bg-rose-50/50 border-rose-200"><CardContent className="p-4">
              <div className="text-xs text-rose-700">Tutuşmayan</div>
              <div className="text-2xl font-bold text-rose-700">{preview.summary.errors}</div>
            </CardContent></Card>
            <Card className="bg-blue-50/50 border-blue-200"><CardContent className="p-4">
              <div className="text-xs text-blue-700">Tətbiq olunacaq</div>
              <div className="text-xl font-bold text-blue-700">{formatAZN(preview.summary.willApplyTotal)}</div>
            </CardContent></Card>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-sm text-muted-foreground">
              Yaşıl sətirlər tətbiq olunacaq, qırmızı/sarı sətirlərə baxılmalıdır
            </div>
            <div className="flex gap-2">
              {preview.summary.errors > 0 && (
                <Button variant="outline" onClick={downloadUnmatched} className="gap-2">
                  <FileDown className="w-4 h-4" /> Tutuşmayanları yüklə
                </Button>
              )}
              <Button
                onClick={handleApply}
                disabled={isLoading || preview.summary.matched === 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {preview.summary.matched} sətri tətbiq et
              </Button>
            </div>
          </div>

          {/* Rows table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Qaimə</th>
                    <th className="px-3 py-3 text-right">Bank məbləği</th>
                    <th className="px-3 py-3 text-left">Müştəri</th>
                    <th className="px-3 py-3 text-left">Əmlak</th>
                    <th className="px-3 py-3 text-right">Cari borc</th>
                    <th className="px-3 py-3 text-right">Tətbiq</th>
                    <th className="px-3 py-3 text-left">Qeyd</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const meta = STATUS_META[r.status];
                    const Icon = meta.icon;
                    return (
                      <tr key={r.rowNumber} className={`border-t border-slate-100 ${meta.bg}`}>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2.5">
                          <div className={`inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                            <Icon className="w-3.5 h-3.5" /> {meta.label}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{r.qaimeNumber || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatAZN(r.amount)}</td>
                        <td className="px-3 py-2.5">{r.customerName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.assetDescription ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right">{r.currentBalance != null ? formatAZN(r.currentBalance) : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-bold">
                          {r.willApply != null ? <span className="text-emerald-700">{formatAZN(r.willApply)}</span> : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 4: DONE */}
      {step === "done" && applyResult && (
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">İdxal tamamlandı</h3>
              <p className="text-muted-foreground mt-2">
                {applyResult.summary.successCount} ödəniş tətbiq edildi
                {applyResult.summary.failedCount > 0 && `, ${applyResult.summary.failedCount} xəta`}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="text-xs text-emerald-700">Uğurlu</div>
                <div className="text-2xl font-bold text-emerald-700">{applyResult.summary.successCount}</div>
              </div>
              <div className="bg-rose-50 rounded-xl p-4">
                <div className="text-xs text-rose-700">Xəta</div>
                <div className="text-2xl font-bold text-rose-700">{applyResult.summary.failedCount}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-700">Cəmi tətbiq</div>
                <div className="text-lg font-bold text-blue-700">{formatAZN(applyResult.summary.totalApplied)}</div>
              </div>
            </div>
            <Button onClick={reset} size="lg" className="gap-2">
              <Upload className="w-4 h-4" /> Yeni fayl yüklə
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
