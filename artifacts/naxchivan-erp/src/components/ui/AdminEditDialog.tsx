import { useState, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface AdminEditDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave: (adminPassword: string) => Promise<void>;
  saveLabel?: string;
}

export function AdminEditDialog({
  open,
  onClose,
  title,
  children,
  onSave,
  saveLabel = "Yadda Saxla",
}: AdminEditDialogProps) {
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setAdminPassword("");
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!adminPassword.trim()) {
      setError("Admin şifrəsi tələb olunur");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave(adminPassword.trim());
      setAdminPassword("");
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Xəta baş verdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {children}

          <div className="pt-3 border-t border-border/60 space-y-2">
            <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Təsdiqi
            </label>
            <Input
              type="password"
              placeholder="Admin şifrəsini daxil edin..."
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="rounded-xl h-11"
              autoComplete="current-password"
            />
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl"
          >
            Ləğv et
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !adminPassword.trim()}
            className="rounded-xl min-w-[120px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
