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
  LogOut,
  Shield,
  UserCog,
  MapPin,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const coreNavigation = [
  { name: "İdarə Paneli", href: "/", icon: LayoutDashboard },
  {
    name: "Aktivlər",
    items: [
      { name: "Məhəllələr", href: "/quarters", icon: MapPin },
      { name: "Binalar", href: "/blocks", icon: Building2 },
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
  { name: "Tariflər", href: "/tariffs", icon: Settings },
];

const adminNavigation = [
  {
    name: "Admin",
    items: [
      { name: "Layihə quraşdırması", href: "/admin/setup", icon: Wand2 },
      { name: "İstifadəçilər", href: "/admin/users", icon: UserCog },
    ]
  }
];

function NavItem({ item, location }: { item: { name: string; href: string; icon: any }; location: string }) {
  const isActive = location === item.href;
  return (
    <Link
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
}

function NavSection({ section, location }: { section: any; location: string }) {
  if (section.items) {
    return (
      <div className="space-y-1">
        <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
          {section.name}
        </h3>
        {section.items.map((item: any) => (
          <NavItem key={item.name} item={item} location={location} />
        ))}
      </div>
    );
  }
  return <NavItem item={section} location={location} />;
}

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const allNavigation = isAdmin ? [...coreNavigation, ...adminNavigation] : coreNavigation;

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

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
        {allNavigation.map((section, idx) => (
          <NavSection key={idx} section={section} location={location} />
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border/50 space-y-2">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              {isAdmin ? <Shield className="w-4 h-4 text-primary" /> : <Users className="w-4 h-4 text-green-400" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.fullName}</div>
              <div className="text-xs text-sidebar-foreground/50">{isAdmin ? "Admin" : "Satış"}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-destructive transition-all duration-200 w-full group"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Çıxış
        </button>
      </div>
    </div>
  );
}
