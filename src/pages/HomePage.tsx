import { Link } from "react-router-dom";
import tileProducts from "../assets/tile-products.jpg";
import tileSales from "../assets/tile-sales.jpg";
import tilePurchases from "../assets/tile-purchases.jpg";
import tileClients from "../assets/tile-clients.jpg";
import tileSuppliers from "../assets/tile-suppliers.jpg";
import tileExpenses from "../assets/tile-expenses.jpg";
import tileBank from "../assets/tile-bank.jpg";
import tileFunds from "../assets/tile-funds.jpg";
import tileReports from "../assets/tile-reports.jpg";
import tileDebtors from "../assets/tile-debtors.jpg";
import tileSettings from "../assets/tile-settings.jpg";
import tileDashboard from "../assets/tile-dashboard.jpg";
import tileOptimisation from "../assets/tile-optimisation.png";

const modules = [
  { to: "/production", label: "Production", image: tileProducts },
  { to: "/produits", label: "Produits", image: tileProducts },
  { to: "/ventes", label: "Ventes", image: tileSales },
  { to: "/caisse", label: "Grande caisse", image: tileBank },
  { to: "/achats", label: "Achats", image: tilePurchases },
  { to: "/clients", label: "Clients", image: tileClients },
  { to: "/fournisseurs", label: "Fournisseurs", image: tileSuppliers },
  { to: "/depenses", label: "Dépenses", image: tileExpenses },
  { to: "/creances", label: "Créances", image: tileDebtors },
  { to: "/rapports", label: "Rapports", image: tileReports },
  { to: "/dashboard", label: "Inventaire", image: tileDashboard },
  { to: "/parametres", label: "Paramètres", image: tileSettings },
];

const quickActions = [
  { to: "/fonds", label: "Fonds & Épargne", image: tileFunds },
  { to: "/optimisation", label: "Optimisation", image: tileOptimisation },
];

function Tile({ label, image }: { label: string; image: string }) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <img
        src={image}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute bottom-1.5 left-2 right-2 text-white text-[11px] sm:text-xs font-semibold drop-shadow leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Bienvenue 👋</h1>
        <p className="text-sm text-gray-500">Choisis une section pour commencer.</p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Actions rapides
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {quickActions.map((a) => (
            <Link key={a.label} to={a.to}>
              <Tile label={a.label} image={a.image} />
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Modules
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-2">
          {modules.map(({ to, label, image }) => (
            <Link key={to} to={to}>
              <Tile label={label} image={image} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
