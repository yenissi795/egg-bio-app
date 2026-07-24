import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Egg,
  Home,
  ShoppingCart,
  Factory,
  Users,
  Wallet,
  Package,
  Receipt,
  DollarSign,
  FileBarChart,
  Archive,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";

const links = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/produits", label: "Produits", icon: Egg },
  { to: "/production", label: "Production", icon: Egg },
  { to: "/ventes", label: "Ventes", icon: ShoppingCart },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Factory },
  { to: "/caisse", label: "Grande caisse", icon: Wallet },
  { to: "/achats", label: "Achats", icon: Package },
  { to: "/depenses", label: "Dépenses", icon: Receipt },
  { to: "/creances", label: "Créances", icon: DollarSign },
  { to: "/rapports", label: "Rapports", icon: FileBarChart },
  { to: "/dashboard", label: "Inventaire", icon: Archive },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-green-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 flex-col bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
        <div className="px-5 py-5 border-b border-white/10">
          <button
            onClick={() => navigate("/")}
            className="text-lg font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Egg size={22} className="text-green-400" />
            ProD EGG BIO
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-600 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-2">
          <p className="text-xs text-white/50 px-3 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-white/5"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Sidebar mobile (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex flex-col">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <button
                onClick={() => {
                  navigate("/");
                  setMobileOpen(false);
                }}
                className="text-lg font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Egg size={22} className="text-green-400" />
                ProD EGG BIO
              </button>
              <button onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-green-600 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-white/10 space-y-2">
              <p className="text-xs text-white/50 px-3 truncate">{user?.email}</p>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-white/5"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {location.pathname !== "/" && (
              <button
                onClick={() => navigate(-1)}
                className="p-1 -ml-1 text-green-800 hover:opacity-70 transition-opacity"
                aria-label="Retour"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <button
              onClick={() => navigate("/")}
              className="text-base font-bold text-green-800 hover:opacity-70 transition-opacity"
            >
              ProD EGG BIO
            </button>
          </div>
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={22} className="text-green-800" />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
