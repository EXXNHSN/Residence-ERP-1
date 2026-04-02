import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2 } from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

const SETTINGS_KEYS = [
  { key: "project_name", label: "Layihə Adı", placeholder: "Naxçıvan Residence", desc: "Login səhifəsində və başlıqda göstərilir" },
  { key: "project_tagline", label: "Layihə Sloqanı", placeholder: "ERP Sistemi", desc: "Login səhifəsindəki kiçik yazı" },
  { key: "project_city", label: "Şəhər / Region", placeholder: "Naxçıvan", desc: "İxtiyari — hesabat başlıqları üçün" },
  { key: "apartment_price_per_sqm", label: "Mənzil qiyməti (m² başına, AZN)", placeholder: "1000", desc: "Mənzil siyahısında avtomatik qiymət hesablanır" },
  { key: "garage_price_per_sqm", label: "Avto Dayanacaq qiyməti (m² başına, AZN)", placeholder: "500", desc: "Avto dayanacaq satışı üçün standart qiymət" },
  { key: "communal_tariff", label: "Kommunal norma (m² başına, AZN/ay)", placeholder: "0.8", desc: "Kommunal hesabat üçün standart tarif" },
];

async function fetchSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE()}/api/admin/settings`);
  return res.json();
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["admin-settings"],
    queryFn: fetchSettings,
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE()}/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Yadda saxlanmadı");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Parametrlər yadda saxlandı" });
    },
    onError: () => {
      toast({ title: "Xəta", description: "Yadda saxlanmadı", variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Bu səhifəyə yalnız admin daxil ola bilər.</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Layihə Parametrləri</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bu platformanı başqa rezidensiya layihələri üçün uyğunlaşdırın
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Ümumi Məlumatlar
          </CardTitle>
          <CardDescription>Layihənin adı, şəhəri — sistemi yenidən istifadə etdikdə dəyişdirin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SETTINGS_KEYS.map(({ key, label, placeholder, desc }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium">{label}</label>
              <Input
                placeholder={placeholder}
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="rounded-xl h-11"
              />
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full gap-2 h-12 rounded-xl"
          >
            <Save className="w-4 h-4" />
            Yadda saxla
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-5 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Yeni layihəyə keçid üçün:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Yuxarıdakı layihə adını dəyişin</li>
            <li>"Layihə quraşdırması" ilə yeni məhəllə/bina strukturu yaradın</li>
            <li>"Mənzil konfiqürasiyası" ilə hər mənzilin sahəsini tənzimləyin</li>
            <li>Yeni istifadəçilər (satış nümayəndələri) əlavə edin</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
