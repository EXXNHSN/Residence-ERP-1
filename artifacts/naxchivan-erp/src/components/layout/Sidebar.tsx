import { useState } from "react";
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
  Tv2,
  Settings,
  LogOut,
  Shield,
  UserCog,
  MapPin,
  Wand2,
  SlidersHorizontal,
  Car,
  ChevronDown,
  ChevronRight,
  Landmark,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

function NavItem({ item, location, indent = false }: { item: { name: string; href: string; icon: any }; location: string; indent?: boolean }) {
  const isActive = location === item.href;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
        indent ? "px-3 pl-5" : "px-3",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
          : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <item.icon className={cn(
        "w-5 h-5 flex-shrink-0 transition-transform duration-200",
        isActive ? "scale-110" : "group-hover:scale-110"
      )} />
      {item.name}
    </Link>
  );
}

function SectionDivider({ icon: Icon, label }: { icon: any; label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 mb-2 mt-1">
      <Icon className="w-4 h-4 text-sidebar-foreground/30 flex-shrink-0" />
      {label && (
        <span className="text-xs font-semibold text-sidebar-foreground/30 uppercase tracking-wider">{label}</span>
      )}
      <div className="flex-1 h-px bg-sidebar-foreground/10" />
    </div>
  );
}

function ExpandableGroup({ icon: Icon, label, children, location, childPaths }: {
  icon: any; label: string; children: React.ReactNode; location: string; childPaths: string[];
}) {
  const isChildActive = childPaths.includes(location);
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full group",
          isChildActive
            ? "bg-sidebar-primary/30 text-white"
            : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
        <span className="flex-1 text-left">{label}</span>
        {open
          ? <ChevronDown className="w-4 h-4 opacity-60" />
          : <ChevronRight className="w-4 h-4 opacity-60" />}
      </button>
      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-sidebar-foreground/15 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

const adminNavigation = [
  { name: "Layihə quraşdırması", href: "/admin/setup", icon: Wand2 },
  { name: "Mənzil konfiqürasiyası", href: "/admin/configure", icon: HomeIcon },
  { name: "İstifadəçilər", href: "/admin/users", icon: UserCog },
  { name: "Layihə parametrləri", href: "/admin/settings", icon: SlidersHorizontal },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="flex flex-col w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen fixed top-0 left-0 z-40 shadow-2xl shadow-slate-900/50">
      {/* Logo */}
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

      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-1">

        {/* Dashboard */}
        <NavItem item={{ name: "İdarə Paneli", href: "/", icon: LayoutDashboard }} location={location} />

        {/* ── Əmlak ── */}
        <div className="pt-3">
          <SectionDivider icon={Landmark} />
          <div className="space-y-0.5">
            <NavItem item={{ name: "Kvartallar", href: "/quarters", icon: MapPin }} location={location} />
            <NavItem item={{ name: "Mənzillər", href: "/apartments", icon: HomeIcon }} location={location} />
            <NavItem item={{ name: "Qeyri Yaşayış", href: "/objects", icon: Store }} location={location} />
            <NavItem item={{ name: "Avto Dayanacaq", href: "/garages", icon: Car }} location={location} />
          </div>
        </div>

        {/* ── Sakinlər ── */}
        <div className="pt-3">
          <SectionDivider icon={Users} />
          <div className="space-y-0.5">
            <NavItem item={{ name: "Sakinlər", href: "/customers", icon: Users }} location={location} />
            <NavItem item={{ name: "Arendatorlar", href: "/renters", icon: Handshake }} location={location} />
          </div>
        </div>

        {/* ── Maliyyə ── */}
        <div className="pt-3">
          <SectionDivider icon={CreditCard} />
          <div className="space-y-0.5">
            <NavItem item={{ name: "Satışlar", href: "/sales", icon: CreditCard }} location={location} />
            <NavItem item={{ name: "Ödənişlər", href: "/installments", icon: CalendarDays }} location={location} />
            <NavItem item={{ name: "İcarə", href: "/rentals", icon: Key }} location={location} />
          </div>
        </div>

        {/* ── Kommunal ── */}
        <div className="pt-3">
          <SectionDivider icon={Zap} />
          <div className="space-y-0.5">
            <ExpandableGroup
              icon={Zap}
              label="Kommunal"
              location={location}
              childPaths={["/communal", "/internet", "/tv"]}
            >
              <NavItem item={{ name: "Kommunal xidmətlər", href: "/communal", icon: Zap }} location={location} indent />
              <NavItem item={{ name: "İnternet", href: "/internet", icon: Wifi }} location={location} indent />
              <NavItem item={{ name: "TV Xidmətləri", href: "/tv", icon: Tv2 }} location={location} indent />
            </ExpandableGroup>
          </div>
        </div>

        {/* ── Tariflər ── */}
        <div className="pt-3">
          <SectionDivider icon={Settings} />
          <NavItem item={{ name: "Tariflər", href: "/tariffs", icon: Settings }} location={location} />
        </div>

        {/* ── Admin ── */}
        {isAdmin && (
          <div className="pt-3">
            <SectionDivider icon={Shield} label="Admin" />
            <div className="space-y-0.5">
              {adminNavigation.map(item => (
                <NavItem key={item.href} item={item} location={location} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
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
