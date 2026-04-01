import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListBlocks, useCreateBlock } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Loader2, MapPin, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBlocksQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { AdminEditDialog } from "@/components/ui/AdminEditDialog";
import { useToast } from "@/hooks/use-toast";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BlocksPage() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const { data: blocks, isLoading } = useListBlocks();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<any>(null);
  const [editName, setEditName] = useState("");

  const queryClient = useQueryClient();
  const { mutate: createBlock, isPending } = useCreateBlock({
    mutation: {
      onSuccess: () => {
        setIsOpen(false);
        setName("");
        queryClient.invalidateQueries({ queryKey: getListBlocksQueryKey() });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    createBlock({ data: { name } });
  };

  function openEdit(block: any) {
    setEditingBlock(block);
    setEditName(block.name);
    setEditOpen(true);
  }

  async function handleSaveBlock(adminPassword: string) {
    const res = await fetch(`${BASE()}/api/blocks/${editingBlock.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user?.username, password: adminPassword, name: editName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Xəta" }));
      throw new Error(err.error ?? "Xəta baş verdi");
    }
    toast({ title: `"${editName}" adı yeniləndi` });
    queryClient.invalidateQueries({ queryKey: getListBlocksQueryKey() });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Binalar</h1>
            <p className="text-muted-foreground mt-1">Bütün bina bloklarının siyahısı</p>
          </div>
          
          {isAdmin && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Plus className="w-5 h-5 mr-2" /> Yeni Bina
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Yeni Bina Əlavə Et</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Bina Adı</label>
                  <Input 
                    placeholder="Məs: A-1 Binası" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="rounded-xl h-12"
                    required
                  />
                </div>
                <Button type="submit" disabled={isPending || !name} className="w-full h-12 rounded-xl text-md">
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yadda saxla"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bina</TableHead>
                  <TableHead>Məhəllə</TableHead>
                  <TableHead className="text-center">Mərtəbə</TableHead>
                  <TableHead className="text-right">Mənzil Sayı</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  blocks?.map((block) => (
                    <TableRow key={block.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" /> {block.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(block as any).quarterName ? (
                          <Badge variant="outline" className="gap-1 font-medium">
                            <MapPin className="w-3 h-3" /> {(block as any).quarterName} Məhəlləsi
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {(block as any).floors ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
                          {block.apartmentCount}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(block)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AdminEditDialog open={editOpen} onClose={() => setEditOpen(false)}
        title="Binanı Redaktə et" onSave={handleSaveBlock}>
        {editingBlock && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Bina adı</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl h-11"
              placeholder="Bina adı..."
            />
          </div>
        )}
      </AdminEditDialog>
    </AppLayout>
  );
}
