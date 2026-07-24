import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Egg, TrendingDown, Package } from "lucide-react";

const PLAQUETTE = 30;

type Period = "week" | "month" | "year";

const eggProductNames = [
  "Plaquette d'œufs petit calibre",
  "Plaquette d'œufs moyen calibre",
  "Plaquette d'œufs gros calibre",
  "Plaquette d'œufs extra calibre",
];

const fmt = (n: number) => n.toLocaleString("fr-FR");

function toPlaquettes(n: number) {
  return Math.round((n / PLAQUETTE) * 10) / 10;
}

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

  // --- Entrées par calibre (depuis egg_production) ---
  const entriesByCalibre: Record<string, number> = { petit: 0, moyen: 0, gros: 0, extra: 0, casses: 0 };
  eggProd
    .filter((e) => inPeriod(e.production_date || e.created_at))
    .forEach((e) => {
      entriesByCalibre.petit += e.petit;
      entriesByCalibre.moyen += e.moyen;
      entriesByCalibre.gros += e.gros;
      entriesByCalibre.extra += e.extra;
      entriesByCalibre.casses += e.casses;
    });

  const totalOeufsProduits =
    entriesByCalibre.petit + entriesByCalibre.moyen + entriesByCalibre.gros + entriesByCalibre.extra;

  // --- Sorties par produit (depuis sale_items) ---
  const exitsByProductName: Record<string, number> = {};
  saleItems
    .filter((si) => si.sales?.created_at && inPeriod(si.sales.created_at))
    .forEach((si) => {
      const name = si.products?.name || "Inconnu";
      exitsByProductName[name] = (exitsByProductName[name] || 0) + si.quantity;
    });

  const totalOeufsSortis = eggProductNames.reduce((s, n) => s + (exitsByProductName[n] || 0), 0);

  // --- Stock restant (toujours l'état actuel, indépendant de la période) ---
  const stockRestantOeufs = products
    .filter((p) => eggProductNames.includes(p.name))
    .reduce((s, p) => s + p.quantity, 0);

  // --- Entrées par nom de produit (mapping calibre -> nom du produit) ---
  const calibreToName: Record<string, string> = {
    petit: "Plaquette d'œufs petit calibre",
    moyen: "Plaquette d'œufs moyen calibre",
    gros: "Plaquette d'œufs gros calibre",
    extra: "Plaquette d'œufs extra calibre",
  };
  const entriesByProductName: Record<string, number> = {};
  Object.entries(calibreToName).forEach(([k, name]) => {
    entriesByProductName[name] = entriesByCalibre[k];
  });
  entriesByProductName["Œufs cassés"] = entriesByCalibre.casses;

  reforms
    .filter((r) => inPeriod(r.created_at))
    .forEach((r) => {
      entriesByProductName["Poules réformées"] = (entriesByProductName["Poules réformées"] || 0) + r.nb_heads;
    });

  manure
    .filter((m) => inPeriod(m.created_at))
    .forEach((m) => {
      entriesByProductName["Fientes / Fumier"] =
        (entriesByProductName["Fientes / Fumier"] || 0) + m.quantity_kg;
    });

  // --- Historique des mouvements (œufs uniquement) ---
  interface Movement {
    date: string;
    type: "Entrée" | "Sortie";
    label: string;
    entree: number;
    sortie: number;
  }
  const movements: Movement[] = [];

  eggProd
    .filter((e) => inPeriod(e.production_date || e.created_at))
    .forEach((e) => {
      const total = e.petit + e.moyen + e.gros + e.extra;
      if (total > 0) {
        movements.push({ date: e.created_at, type: "Entrée", label: "Ponte du jour", entree: total, sortie: 0 });
      }
    });

  saleItems
    .filter(
      (si) => si.sales?.created_at && inPeriod(si.sales.created_at) && eggProductNames.includes(si.products?.name)
    )
    .forEach((si) => {
      movements.push({
        date: si.sales.created_at,
        type: "Sortie",
        label: `Vente — ${si.products?.name}`,
        entree: 0,
        sortie: si.quantity,
      });
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
                <p className="text-xs text-gray-500">Œufs produits</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(totalOeufsProduits)} œufs</p>
              <p className="text-xs text-gray-400">≈ {fmt(toPlaquettes(totalOeufsProduits))} plaquette(s)</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-xs text-gray-500">Œufs sortis (ventes)</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(totalOeufsSortis)} œufs</p>
              <p className="text-xs text-gray-400">≈ {fmt(toPlaquettes(totalOeufsSortis))} plaquette(s)</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Package size={16} className="text-blue-600" />
                <p className="text-xs text-gray-500">Stock restant (œufs)</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(stockRestantOeufs)} œufs</p>
              <p className="text-xs text-gray-400">= {fmt(toPlaquettes(stockRestantOeufs))} plaquette(s)</p>
            </div>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Détail par produit</h2>
            <p className="text-xs text-gray-400 mb-3">
              Œufs affichés en unités ET en plaquettes de 30. Les autres produits gardent leur unité (tête,
              sac...).
            </p>
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Catégorie</th>
                  <th className="pb-2 pr-4 font-medium">Produit</th>
                  <th className="pb-2 pr-4 font-medium text-right">Entrées (production / achat)</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sorties (ventes)</th>
                  <th className="pb-2 font-medium text-right">Stock restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => {
                  const isEgg = eggProductNames.includes(p.name);
                  const entree = entriesByProductName[p.name] || 0;
                  const sortie = exitsByProductName[p.name] || 0;
                  const unitLabel = isEgg ? "œufs" : p.unit;
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-4 text-gray-600">{p.category}</td>
                      <td className="py-2 pr-4 text-gray-800">
                        {p.name} <span className="text-gray-400 text-xs">({p.unit})</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-green-700">
                        +{fmt(entree)} {unitLabel}
                        {isEgg && (
                          <div className="text-[10px] text-gray-400">≈ {toPlaquettes(entree)} plaquette(s)</div>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-600">
                        −{fmt(sortie)} {unitLabel}
                        {isEgg && (
                          <div className="text-[10px] text-gray-400">≈ {toPlaquettes(sortie)} plaquette(s)</div>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-800">
                        {fmt(p.quantity)} {unitLabel}
                        {isEgg && (
                          <div className="text-[10px] text-gray-400 font-normal">
                            = {toPlaquettes(p.quantity)} plaquette(s)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Historique des mouvements — œufs</h2>
            <p className="text-xs text-gray-400 mb-3">1 plaquette = 30 œufs. Les conversions sont automatiques.</p>
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
                      <td className="py-2 text-right text-red-600">
                        {m.sortie > 0 ? `−${fmt(m.sortie)}` : "—"}
                      </td>
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
