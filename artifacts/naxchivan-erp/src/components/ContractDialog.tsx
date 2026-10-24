import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, FileDown, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ContractDialogProps {
  saleId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export function ContractDialog({ saleId, open, onOpenChange }: ContractDialogProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !saleId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const token = sessionStorage.getItem("naxchivan_erp_token");

    fetch(`${BASE()}/api/contracts/${saleId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Müqavilə məlumatı tapılmadı");
        return r.json();
      })
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, saleId]);

  const handleDownloadDocx = async () => {
    if (!saleId) return;
    setDownloading(true);
    try {
      const token = sessionStorage.getItem("naxchivan_erp_token");
      const res = await fetch(`${BASE()}/api/contracts/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Müqavilə faylı yaradıla bilmədi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="(.+?)"/);
      a.download = match ? decodeURIComponent(match[1]) : `muqavile-${saleId}.docx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Xəta baş verdi");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-none shadow-2xl">
        {/* Modal Controls Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white/95 backdrop-blur border-b border-border/60 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-foreground">
              {data?.asset?.assetType === "object" ? "Qeyri-yaşayış Müqaviləsi" : "Mənzil Alqı-Satqı Müqaviləsi"}
            </span>
            {data?.contractNo && (
              <span className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                № {data.contractNo}
              </span>
            )}
            {data?.qaimeNo && (
              <span className="text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Qaimə: {data.qaimeNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!data || loading}
              className="rounded-xl gap-1.5 h-9"
            >
              <Printer className="w-4 h-4 text-primary" /> Çap et
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadDocx}
              disabled={!data || loading || downloading}
              className="rounded-xl gap-1.5 h-9 bg-primary hover:bg-primary/90"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Word (.docx) Endir
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10 bg-slate-100/60 print:bg-white print:p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Müqavilə məlumatları hazırlanır...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive text-sm font-medium">
              {error}
            </div>
          ) : data ? (
            <div
              id="printable-contract"
              className="bg-white rounded-xl shadow-sm border border-border/70 p-8 sm:p-14 text-[#111] font-serif text-[13.5px] leading-relaxed max-w-3xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-none"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              {/* Top Header */}
              <div className="text-right text-xs font-semibold mb-4 text-slate-700">
                <span>Müqavilə №: <u>{data.contractNo}</u></span>
                {data.qaimeNo && (
                  <span className="ml-4">Qaimə №: <u>{data.qaimeNo}</u></span>
                )}
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide uppercase">
                  İLKİN MÜQAVİLƏ
                </h1>
                <p className="text-sm italic text-slate-600 mt-1">
                  {data.asset.titleSub}
                </p>
              </div>

              {/* Preamble */}
              <p className="indent-8 text-justify mb-4">
                Hazırkı ilkin müqavilə <strong>{data.contractDate}</strong> tarixdə, Azərbaycan Respublikası, Naxçıvan Muxtar Respublikasının, Naxçıvan şəhərində, aşağıda göstərilən şəxslər arasında imzalanmışdır:
              </p>

              {/* Parties */}
              <p className="indent-8 text-justify mb-3">
                Nizamnaməsi əsasında fəaliyyət göstərən direktoru {data.seller.director} şəxsində təmsil edilən, Azərbaycan Respublikasının qanunvericiliyinə uyğun yaradılmış və fəaliyyət göstərən <strong>{data.seller.name}</strong> (bundan sonra – <strong>Satıcı</strong>) bir tərəfdən və
              </p>
              <p className="indent-8 text-justify mb-4">
                Azərbaycan Respublikasının vətəndaşı <strong>{data.buyerFullName}</strong> (Ş/V № <strong>{data.idCard}</strong>, FİN: <strong>{data.fin}</strong>), (bundan sonra – <strong>Alıcı</strong>).
              </p>

              {/* Nəzərə alaraq */}
              <p className="font-bold mb-1">NƏZƏRƏ ALARAQ Kİ,</p>
              <p className="indent-8 text-justify mb-2">
                Satıcı <strong>{data.seller.address}</strong> ünvanda yerləşən və bu müqavilənin 1-ci maddəsində qeyd edilən {data.asset.objectTypeDesc} (bundan sonra – Əmlak) tikintisi başa çatdıqdan sonra özgəninkiləşdirmək niyyətindədir; və
              </p>
              <p className="indent-8 text-justify mb-2">
                Alıcı göstərilən Əmlakın üzərində alqı-satqı müqaviləsi bağlamaqla mülkiyyət hüququ əldə etməkdə maraqlıdır və bu məqsədlə Satıcı ilə ilkin razılıq əldə edilmişdir;
              </p>
              <p className="indent-8 text-justify mb-4">
                Bununla Tərəflər aşağıdakılar barədə razılığa gəldilər:
              </p>

              {/* Section 1 */}
              <h2 className="text-center font-bold text-sm tracking-wide uppercase mt-6 mb-3">
                1. MÜQAVİLƏNİN PREDMETİ
              </h2>
              <p className="indent-8 text-justify mb-4">
                1.1. Bu müqaviləyə əsasən, Satıcı aşağıdakı cədvəldə göstərilmiş Əmlakın tikintisi başa çatdıqdan sonra bağlanacaq əsas alqı-satqı müqaviləsi əsasında Əmlakı Alıcıya təhvil vermək, Alıcı isə, bunun qarşılığında Satıcıya bu müqavilə ilə müəyyən edilmiş məbləği ödəməyi və digər öhdəlikləri icra etməyi öhdəsinə götürür.
              </p>

              {/* Table 1 */}
              <div className="my-5">
                <p className="text-center font-bold text-xs mb-2">Cədvəl 1 (Əmlakın xarakteristikası)</p>
                <table className="w-full border-collapse border border-slate-800 text-xs text-left">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="p-2 border-r border-slate-800 font-bold w-2/5 bg-slate-50">Layihə:</td>
                      <td className="p-2 font-medium">Naxçıvan Residence</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Kompleks:</td>
                      <td className="p-2">{data.asset.buildingName || "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Blok / Ünvan:</td>
                      <td className="p-2">{data.asset.blockName || "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Mərtəbə:</td>
                      <td className="p-2">{data.asset.floor}</td>
                    </tr>
                    {data.asset.assetType === "apartment" ? (
                      <>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Otaqların sayı:</td>
                          <td className="p-2">{data.asset.rooms}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Mənzil №-si:</td>
                          <td className="p-2 font-bold">{data.asset.number}</td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Fəaliyyət növü / Təyinat:</td>
                          <td className="p-2">{data.asset.activityType}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Obyekt №-si:</td>
                          <td className="p-2 font-bold">{data.asset.number}</td>
                        </tr>
                      </>
                    )}
                    <tr className="border-b border-slate-800">
                      <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Ümumi sahə (m²):</td>
                      <td className="p-2 font-bold">{data.asset.area} m²</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-800 font-bold bg-slate-50">Satış qiyməti:</td>
                      <td className="p-2 font-bold text-slate-900">{formatCurrency(data.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2 */}
              <h2 className="text-center font-bold text-sm tracking-wide uppercase mt-6 mb-3">
                2. TƏRƏFLƏRİN HÜQUQ VƏ VƏZİFƏLƏRİ
              </h2>
              <p className="text-justify mb-2">
                2.1. <strong>Satıcının hüquq və vəzifələri:</strong> Alıcıdan Əmlakın dəyərini və digər xərcləri vaxtında tələb etmək hüququna malikdir. Satıcı Əmlakın keyfiyyətinə və layihə üzrə mühəndis kommunikasiya xətlərinin çəkilməsinə zəmanət verir.
              </p>
              <p className="text-justify mb-3">
                2.2. Əmlak tikinti işləri başa çatdıqdan sonra {data.isCredit ? <strong>{data.finalPayDate} tarixə qədər</strong> : "əsas alqı-satqı müqaviləsi əsasında"} Alıcıya təhvil veriləcəkdir.
              </p>

              {/* Section 3 */}
              <h2 className="text-center font-bold text-sm tracking-wide uppercase mt-6 mb-3">
                3. MÜQAVİLƏ QİYMƏTİ VƏ HESABLAŞMA QAYDASI
              </h2>
              <p className="indent-8 text-justify mb-3">
                3.1. Əmlakın 1 m² üçün razılaşdırılmış qiymət <strong>{formatCurrency(data.pricePerSqm)} ({data.pricePerSqmWords})</strong> məbləğində müəyyən edilmişdir. Əmlakın yekun satış dəyəri <strong>{formatCurrency(data.totalAmount)} ({data.totalAmountWords})</strong> təşkil edir.
              </p>

              {data.isCredit ? (
                <p className="indent-8 text-justify mb-3">
                  3.2. Alıcı Əmlakın dəyərini bu müqavilə imzalandığı anda <strong>{formatCurrency(data.downPayment)} ({data.downPaymentWords})</strong> ilkin ödəniş olaraq ödəyir. Qalıq borc məbləği <strong>{formatCurrency(data.remaining)} ({data.remainingWords})</strong> təşkil edir və <strong>{data.installStartDate}</strong> tarixdən etibarən <strong>{data.installmentMonths} ay</strong> ərzində hər ay <strong>{formatCurrency(data.monthlyPayment)} ({data.monthlyPaymentWords})</strong> olmaqla ödənilir.
                </p>
              ) : (
                <p className="indent-8 text-justify mb-3">
                  3.2. Alıcı Əmlakın tam dəyərini <strong>{formatCurrency(data.totalAmount)} ({data.totalAmountWords})</strong> bu müqavilə imzalandığı tarixdə birdəfəlik nağd və ya bank köçürməsi yolu ilə ödəyir.
                </p>
              )}

              {/* Section 4 */}
              <h2 className="text-center font-bold text-sm tracking-wide uppercase mt-6 mb-3">
                4. MÜQAVİLƏNİN QÜVVƏYƏ MİNMƏSİ
              </h2>
              <p className="indent-8 text-justify mb-6">
                4.1. Bu müqavilə <strong>{data.contractDate}</strong> tarixdən qüvvəyə minir və əsas alqı-satqı müqaviləsi bağlanana qədər qüvvədə qalır. Müqavilə eyni hüquqi qüvvəyə malik 2 (iki) nüsxədə tərtib olunmuşdur.
              </p>

              {/* Signatures */}
              <div className="mt-10 pt-6 border-t border-slate-400">
                <h3 className="text-center font-bold text-xs uppercase mb-6">
                  TƏRƏFLƏRİN REKVİZİTLƏRİ VƏ İMZALARI
                </h3>
                <div className="grid grid-cols-2 gap-8 text-xs leading-relaxed">
                  <div>
                    <p className="font-bold text-sm mb-1">SATICI:</p>
                    <p className="font-semibold">{data.seller.shortName}</p>
                    <p className="text-slate-600">{data.seller.address}</p>
                    <p className="text-slate-700 mt-1">Direktor: {data.seller.director}</p>
                    <div className="mt-8 pt-2">
                      <p>İmza: ______________________</p>
                      <p className="text-slate-500 text-[11px] mt-1">M.Y.</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">ALICI:</p>
                    <p className="font-semibold">{data.buyerFullName}</p>
                    <p className="text-slate-600">Ş/V: {data.idCard} | FİN: {data.fin}</p>
                    <p className="text-slate-600">Ünvan: {data.address || "Naxçıvan şəhəri"}</p>
                    <p className="text-slate-700 mt-1">Əlaqə: {data.phone || "—"}</p>
                    <div className="mt-8 pt-2">
                      <p>İmza: ______________________</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
