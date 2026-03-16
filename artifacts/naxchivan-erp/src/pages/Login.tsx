import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message ?? "Xəta baş verdi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Naxçıvan Residence</h1>
          <p className="text-slate-400 mt-1">ERP Sistemi</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-xl text-center">Sisteme Daxil Ol</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">İstifadəçi adı</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="rounded-xl h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Şifrə</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all mt-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Daxil ol"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
