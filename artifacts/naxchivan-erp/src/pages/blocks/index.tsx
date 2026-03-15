import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListBlocks, useCreateBlock } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBlocksQueryKey } from "@workspace/api-client-react";

export default function BlocksPage() {
  const { data: blocks, isLoading } = useListBlocks();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Bloklar</h1>
            <p className="text-muted-foreground mt-1">Bina bloklarının idarə edilməsi</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Plus className="w-5 h-5 mr-2" /> Yeni Blok
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Yeni Blok Əlavə Et</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Blok Adı (Məs: A Bloku)</label>
                  <Input 
                    placeholder="Daxil edin..." 
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
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Blok Adı</TableHead>
                  <TableHead className="text-right">Mənzil Sayı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">Məlumat tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  blocks?.map((block) => (
                    <TableRow key={block.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">#{block.id}</TableCell>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> {block.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
                          {block.apartmentCount}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
