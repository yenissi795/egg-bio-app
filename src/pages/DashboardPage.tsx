import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Egg, TrendingDown, Package } from "lucide-react";

type Period = "week" | "month" | "year";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const EGG_PRODUCT = "Plaquette d'œufs";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [products, setProducts] = useState<any[]>([]);
  const [eggProd, setEggProd] = useState<any[]>([]);
  const [reforms, setReforms] = useState<any[]>([]);
  const [manure, setManure] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { data: productsData },
      { data: eggData },
      { data: reformsData },
      { data: manureData },
      { data: itemsData },
    ] = await Promise.all([
      supabase.from("products").select("id, name, category, unit, quantity"),
      supabase.from("egg_production").select("*"),
      supabase.from("reforms").select("*"),
      supabase.from("manure_productions").select("*"),
      supabase.from("sale_items").select("id, product_id, quantity, sales(created_at), products(name)"),
    ]);
    setProducts(productsData || []);
    setEggProd(eggData || []);
    setReforms(reformsData || []);
    setManure(manureData || []);
    setSaleItems((itemsData as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const inPeriod = (iso: string) => {
    const d = new Date(iso);
    if (period === "week") {
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear();
  };

  // --- Plaquettes produites (période) + œufs cassés (info seulement) ---
  const periodEggProd = eggProd.filter((e) => inPeriod(e.production_date || e.created_at));
  const plaquettesProduites = periodEggProd.reduce((s, e) => s + (e.plaquettes || 0), 0);
  const oeufsCassesInfo = periodEggProd.reduce((s, e) => s + (e.casses || 0), 0);

  // --- Plaquettes sorties (ventes, période) ---
  const plaquettesSorties = saleItems
    .filter(
      (si) =>
        si.sales?.created_at && inPeriod(si.sales.created_at) && si.products?.name === EGG_PRODUCT
    )
    .reduce((s, si) => s + si.quantity, 0);

  // --- Stock restant (état actuel, indépendant de la période) ---
  const eggProduct = products.find((p) => p.name === EGG_PRODUCT);
  const stockRestant = eggProduct?.quantity || 0;

  // --- Entrées par produit (pour le tableau détail) ---
  const entriesByProductName: Record<string, number> = { [EGG_PRODUCT]: plaquettesProduites };
  reforms
    .filter((r) => inPeriod(r.created_at))
    .forEach((r) => {
      entriesByProductName["Poules réformées"] = (entriesByProductName["Poules réformées"] || 0) + r.nb_heads;
    });
  manure
    .filter((m) => inPeriod(m.created_at))
    .forEach((m) => {
      entriesByProductName["Fientes / Fumier"] = (entriesByProductName["Fientes / Fumier"] || 0) + m.quantity_kg;
    });

  // --- Sorties par produit (toutes ventes, pas juste les œufs) ---
  const exitsByProductName: Record<string, number> = {};
  saleItems
    .filter((si) => si.sales?.created_at && inPeriod(si.sales.created_at))
    .forEach((si) => {
      const name = si.products?.name || "Inconnu";
      exitsByProductName[name] = (exitsByProductName[name] || 0) + si.quantity;
    });

  // --- Historique des mouvements (plaquettes) ---
  interface Movement {
    date: string;
    type: "Entrée" | "Sortie";
    label: string;
    entree: number;
    sortie: number;
  }
  const movements: Movement[] = [];

  periodEggProd.forEach((e) => {
    if (e.plaquettes > 0) {
      const label = e.casses > 0 ? `Ponte du jour (+ ${e.casses} œuf(s) cassé(s))` : "Ponte du jour";
      movements.push({ date: e.created_at, type: "Entrée", label, entree: e.plaquettes, sortie: 0 });
    }
  });

  saleItems
    .filter(
      (si) => si.sales?.created_at && inPeriod(si.sales.created_at) && si.products?.name === EGG_PRODUCT
    )
    .forEach((si) => {
      movements.push({ date: si.sales.created_at, type: "Sortie", label: "Vente", entree: 0, sortie: si.quantity });
    });

  movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const periodTitle = period === "week" ? "Semaine" : period === "month" ? "Mois" : "Année";
  const periodLabel =
    period === "week"
      ? "7 derniers jours"
      : period === "month"
      ? now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : `Année ${now.getFullYear()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Inventaire — {periodTitle}</h1>
          <p className="text-sm text-gray-500 capitalize">{periodLabel}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                period === p ? "bg-white text-green-700 shadow-sm" : "text-gray-500"
              }`}
            >
              {p === "week" ? "Semaine" : p === "month" ? "Mois" : "Année"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Egg size={16} className="text-green-600" />
                <p className="text-xs text-gray-500">Plaquettes d'œufs produites</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(plaquettesProduites)} plaquette(s)</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-xs text-gray-500">Plaquettes sorties (ventes)</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(plaquettesSorties)} plaquette(s)</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Package size={16} className="text-blue-600" />
                <p className="text-xs text-gray-500">Stock restant</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(stockRestant)} plaquette(s)</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            Info : {fmt(oeufsCassesInfo)} œuf(s) cassé(s) sur la période — donnée informative uniquement (pour le suivi
            du taux de casse), ne fait pas partie du stock vendable.
          </p>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">Détail par produit</h2>
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Catégorie</th>
                  <th className="pb-2 pr-4 font-medium">Produit</th>
                  <th className="pb-2 pr-4 font-medium text-right">Entrées (production / réforme)</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sorties (ventes)</th>
                  <th className="pb-2 font-medium text-right">Stock restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => {
                  const entree = entriesByProductName[p.name] || 0;
                  const sortie = exitsByProductName[p.name] || 0;
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-4 text-gray-600">{p.category}</td>
                      <td className="py-2 pr-4 text-gray-800">
                        {p.name} <span className="text-gray-400 text-xs">({p.unit})</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-green-700">
                        +{fmt(entree)} {p.unit}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-600">
                        −{fmt(sortie)} {p.unit}
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-800">
                        {fmt(p.quantity)} {p.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des mouvements — Plaquette d'œufs</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun mouvement sur cette période.</p>
            ) : (
              <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Libellé</th>
                    <th className="pb-2 pr-4 font-medium text-right">Entrée</th>
                    <th className="pb-2 font-medium text-right">Sortie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.slice(0, 50).map((m, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                        {new Date(m.date).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            m.type === "Entrée" ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-800">{m.label}</td>
                      <td className="py-2 pr-4 text-right text-green-700">
                        {m.entree > 0 ? `+${fmt(m.entree)}` : "—"}
                      </td>
                      <td className="py-2 text-right text-red-600">{m.sortie > 0 ? `−${fmt(m.sortie)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
