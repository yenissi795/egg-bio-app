import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { AlertTriangle, TrendingUp, TrendingDown, Egg, Skull, Wheat, CheckCircle2 } from "lucide-react";

export default function OptimizationPage() {
  const fmt = useCurrencyFormatter();

  const [flocks, setFlocks] = useState<any[]>([]);
  const [mortalities, setMortalities] = useState<any[]>([]);
  const [eggProd, setEggProd] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { data: flocksData },
      { data: mortData },
      { data: eggData },
      { data: purchasesData },
      { data: expensesData },
      { data: itemsData },
    ] = await Promise.all([
      supabase.from("flocks").select("*"),
      supabase.from("flock_mortality").select("*"),
      supabase.from("egg_production").select("*"),
      supabase.from("purchases").select("*, inputs(category, unit)"),
      supabase.from("expenses").select("*"),
      supabase.from("sale_items").select("quantity, unit_price, sales(created_at), products(name, unit)"),
    ]);
    setFlocks(flocksData || []);
    setMortalities(mortData || []);
    setEggProd(eggData || []);
    setPurchases(purchasesData || []);
    setExpenses(expensesData || []);
    setSaleItems((itemsData as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const thisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  };

  // --- Taux de casse (mois courant) ---
  const eggEntries = eggProd.filter((e) => thisMonth(e.production_date || e.created_at));
  const totalBons = eggEntries.reduce((s, e) => s + e.petit + e.moyen + e.gros + e.extra, 0);
  const totalCasses = eggEntries.reduce((s, e) => s + e.casses, 0);
  const totalProduits = totalBons + totalCasses;
  const tauxCasse = totalProduits > 0 ? (totalCasses / totalProduits) * 100 : 0;

  // --- Taux de mortalité (mois courant) ---
  const mortThisMonth = mortalities
    .filter((m) => thisMonth(m.mortality_date || m.created_at))
    .reduce((s, m) => s + m.count, 0);
  const totalInitialCount = flocks.reduce((s, f) => s + f.initial_count, 0);
  const tauxMortalite = totalInitialCount > 0 ? (mortThisMonth / totalInitialCount) * 100 : 0;

  // --- Conversion alimentaire (mois courant) ---
  const kgAlimentAchete = purchases
    .filter((p) => p.inputs?.category === "Aliments pour bétail" && thisMonth(p.created_at))
    .reduce((s, p) => {
      // Convertit en kg si l'unité est déjà kg ; sinon on prend la quantité telle quelle (approximation)
      return s + p.quantity;
    }, 0);
  const conversionAlimentaire = totalProduits > 0 ? (kgAlimentAchete * 1000) / totalProduits : 0; // grammes / œuf

  // --- Taux de ponte moyen (mois courant) ---
  const totalHensNow = flocks
    .filter((f) => f.status === "laying")
    .reduce((s, f) => {
      const lost = mortalities.filter((m) => m.flock_id === f.id).reduce((ss, m) => ss + m.count, 0);
      return s + Math.max(0, f.initial_count - lost);
    }, 0);
  const daysElapsed = now.getDate();
  const layingRate = totalHensNow > 0 && daysElapsed > 0 ? (totalBons / (totalHensNow * daysElapsed)) * 100 : 0;

  // --- Dépenses par catégorie : mois courant vs mois précédent ---
  const categories = ["maintenance", "entretien", "exploitation", "personnel", "transport", "administration"];
  const categoryLabels: Record<string, string> = {
    maintenance: "Maintenance",
    entretien: "Entretien",
    exploitation: "Exploitation",
    personnel: "Personnel",
    transport: "Transport",
    administration: "Administration",
  };
  const expenseComparison = categories.map((cat) => {
    const current = expenses
      .filter((e) => e.category === cat && thisMonth(e.created_at))
      .reduce((s, e) => s + e.amount, 0);
    const previous = expenses
      .filter((e) => e.category === cat && lastMonth(e.created_at))
      .reduce((s, e) => s + e.amount, 0);
    const variation = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    return { cat, label: categoryLabels[cat], current, previous, variation };
  });

  // --- Ventes par calibre (mois courant) ---
  const eggCalibreNames = [
    "Plaquette d'œufs petit calibre",
    "Plaquette d'œufs moyen calibre",
    "Plaquette d'œufs gros calibre",
    "Plaquette d'œufs extra calibre",
  ];
  const revenueByCalibre: Record<string, { qty: number; revenue: number }> = {};
  saleItems
    .filter((si) => si.sales?.created_at && thisMonth(si.sales.created_at) && eggCalibreNames.includes(si.products?.name))
    .forEach((si) => {
      const name = si.products.name;
      if (!revenueByCalibre[name]) revenueByCalibre[name] = { qty: 0, revenue: 0 };
      revenueByCalibre[name].qty += si.quantity / 30;
      revenueByCalibre[name].revenue += si.quantity * si.unit_price;
    });
  const totalEggRevenue = Object.values(revenueByCalibre).reduce((s, v) => s + v.revenue, 0);

  // --- Alertes dynamiques ---
  const alerts: { level: "danger" | "warning"; text: string }[] = [];
  if (totalProduits > 0 && tauxCasse > 3) {
    alerts.push({
      level: "danger",
      text: `Taux de casse élevé (${tauxCasse.toFixed(1)}%) — vérifie la manipulation et le stockage des œufs.`,
    });
  }
  if (totalInitialCount > 0 && tauxMortalite > 2) {
    alerts.push({
      level: "danger",
      text: `Taux de mortalité élevé ce mois (${tauxMortalite.toFixed(1)}%) — vérifie la santé du cheptel et les conditions d'élevage.`,
    });
  }
  if (conversionAlimentaire > 0 && conversionAlimentaire > 130) {
    alerts.push({
      level: "warning",
      text: `Conversion alimentaire élevée (${conversionAlimentaire.toFixed(0)}g d'aliment par œuf) — la norme est autour de 110-130g. Vérifie le gaspillage d'aliment.`,
    });
  }
  expenseComparison.forEach((c) => {
    if (c.previous > 0 && c.variation > 20) {
      alerts.push({
        level: "warning",
        text: `Dépenses "${c.label}" en hausse de ${c.variation.toFixed(0)}% par rapport au mois dernier.`,
      });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Optimisation</h1>
        <p className="text-sm text-gray-500">
          Réduis les pertes et optimise tes coûts pour produire plus, en dépensant moins.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <>
          {alerts.length > 0 ? (
            <div className="space-y-1.5">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
                    a.level === "danger"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2">
              <CheckCircle2 size={14} />
              <span>Aucune anomalie détectée ce mois-ci — continue comme ça !</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <Egg size={15} className={tauxCasse > 3 ? "text-red-500" : "text-green-600"} />
                <p className="text-xs text-gray-500">Taux de casse</p>
              </div>
              <p className={`text-lg font-bold ${tauxCasse > 3 ? "text-red-600" : "text-gray-800"}`}>
                {tauxCasse.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400">Norme : &lt; 3%</p>
            </div>
            <div className="stat-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <Skull size={15} className={tauxMortalite > 2 ? "text-red-500" : "text-green-600"} />
                <p className="text-xs text-gray-500">Mortalité (mois)</p>
              </div>
              <p className={`text-lg font-bold ${tauxMortalite > 2 ? "text-red-600" : "text-gray-800"}`}>
                {tauxMortalite.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400">Norme : &lt; 2%</p>
            </div>
            <div className="stat-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wheat size={15} className={conversionAlimentaire > 130 ? "text-amber-500" : "text-green-600"} />
                <p className="text-xs text-gray-500">Conversion alim.</p>
              </div>
              <p className={`text-lg font-bold ${conversionAlimentaire > 130 ? "text-amber-600" : "text-gray-800"}`}>
                {conversionAlimentaire.toFixed(0)} g/œuf
              </p>
              <p className="text-[10px] text-gray-400">Norme : 110-130g</p>
            </div>
            <div className="stat-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={15} className="text-blue-600" />
                <p className="text-xs text-gray-500">Taux de ponte</p>
              </div>
              <p className="text-lg font-bold text-gray-800">{layingRate.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-400">Norme : 80-95%</p>
            </div>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Ventes par calibre — ce mois-ci</h2>
            <p className="text-xs text-gray-400 mb-3">Identifie les calibres les plus rentables.</p>
            {Object.keys(revenueByCalibre).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune vente d'œufs ce mois-ci.</p>
            ) : (
              <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">Calibre</th>
                    <th className="pb-2 pr-4 font-medium text-right">Plaquettes vendues</th>
                    <th className="pb-2 pr-4 font-medium text-right">Chiffre d'affaires</th>
                    <th className="pb-2 font-medium text-right">Part du CA œufs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.entries(revenueByCalibre)
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([name, v]) => (
                      <tr key={name}>
                        <td className="py-2 pr-4 text-gray-800">{name}</td>
                        <td className="py-2 pr-4 text-right text-gray-600">{v.qty.toFixed(1)}</td>
                        <td className="py-2 pr-4 text-right font-medium text-gray-800">{fmt(v.revenue)}</td>
                        <td className="py-2 text-right text-gray-500">
                          {totalEggRevenue > 0 ? ((v.revenue / totalEggRevenue) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Dépenses par catégorie — évolution</h2>
            <p className="text-xs text-gray-400 mb-3">
              Comparaison entre {lastMonthDate.toLocaleDateString("fr-FR", { month: "long" })} et{" "}
              {now.toLocaleDateString("fr-FR", { month: "long" })}.
            </p>
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Catégorie</th>
                  <th className="pb-2 pr-4 font-medium text-right">Mois dernier</th>
                  <th className="pb-2 pr-4 font-medium text-right">Ce mois-ci</th>
                  <th className="pb-2 font-medium text-right">Variation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenseComparison.map((c) => (
                  <tr key={c.cat}>
                    <td className="py-2 pr-4 text-gray-800">{c.label}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{fmt(c.previous)}</td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-800">{fmt(c.current)}</td>
                    <td className="py-2 text-right">
                      {c.previous === 0 && c.current === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`flex items-center justify-end gap-1 font-medium ${
                            c.variation > 20 ? "text-red-600" : c.variation < 0 ? "text-green-600" : "text-gray-600"
                          }`}
                        >
                          {c.variation > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {c.variation.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
