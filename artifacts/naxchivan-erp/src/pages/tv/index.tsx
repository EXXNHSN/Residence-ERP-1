import { AppLayout } from "@/components/layout/AppLayout";
import { Tv2, Construction } from "lucide-react";

export default function TvPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">TV Xidmətləri</h1>
          <p className="text-muted-foreground mt-1">Sakinlərin kabel TV abunəliklərinin idarəsi</p>
        </div>
        <div className="bg-white rounded-2xl border border-border/60 shadow-sm py-20 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
            <Tv2 className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">TV Xidmət Modulu</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Bu bölmə tezliklə aktivləşdiriləcək. Kabel TV abunəliklərini, ödənişləri və paketləri idarə edə biləcəksiniz.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/60 bg-muted/40 rounded-xl px-4 py-2">
            <Construction className="w-3.5 h-3.5" />
            Hazırlanır...
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
