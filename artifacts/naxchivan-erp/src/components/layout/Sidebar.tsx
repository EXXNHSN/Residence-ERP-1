import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  Home as HomeIcon, 
  Store, 
  Users, 
  CreditCard, 
  CalendarDays, 
  Key, 
  Zap, 
  Wifi, 
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "İdarə Paneli", href: "/", icon: LayoutDashboard },
  {
    name: "Aktivlər",
    items: [
      { name: "Bloklar", href: "/blocks", icon: Building2 },
      { name: "Mənzillər", href: "/apartments", icon: HomeIcon },
      { name: "Obyekt / Qaraj", href: "/objects", icon: Store },
    ]
  },
  { name: "Müştərilər", href: "/customers", icon: Users },
  { name: "Satışlar", href: "/sales", icon: CreditCard },
  { name: "Ödənişlər", href: "/installments", icon: CalendarDays },
  { name: "Kirayə", href: "/rentals", icon: Key },
  { name: "Kommunal", href: "/communal", icon: Zap },
  { name: "İnternet", href: "/internet", icon: Wifi },
  { name: "Admin / Tariflər", href: "/tariffs", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen fixed top-0 left-0 z-40 shadow-2xl shadow-slate-900/50">
      <div className="p-6 border-b border-sidebar-border/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-lg shadow-primary/20">
          <img 
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`} 
            alt="Logo" 
            className="w-6 h-6 object-contain"
          />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-white">Naxçıvan</h1>
          <p className="text-xs text-sidebar-foreground/60 font-medium tracking-wider uppercase">Residence</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
        {navigation.map((section, idx) => (
          <div key={idx}>
            {section.items ? (
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
                  {section.name}
                </h3>
                {section.items.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                        isActive 
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20" 
                          : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon className={cn(
                        "w-5 h-5 transition-transform duration-200",
                        isActive ? "scale-110" : "group-hover:scale-110"
                      )} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Link
                href={section.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  location === section.href 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <section.icon className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  location === section.href ? "scale-110" : "group-hover:scale-110"
                )} />
                {section.name}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border/50">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-destructive transition-all duration-200 w-full group">
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Çıxış
        </button>
      </div>
    </div>
  );
}
