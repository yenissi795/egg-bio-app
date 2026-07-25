import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Egg, Skull, Wheat, CheckCircle2 } from "lucide-react";

const EGG_PRODUCT = "Plaquette d'œufs";
const PLAQUETTE = 30;
const AMORTIZATION_MONTHS = 12; // Durée de ponte typique sur laquelle on étale le coût d'achat des poulettes

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
      supabase.from("purchases").select("*, inputs(category, unit, name)"),
      supabase.from("expenses").select("*"),
      supabase.from("sale_items").select("quantity, unit_price, sales(created_at), products(name)"),
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

  const activeHensOf = (flockId: string) => {
    const flock = flocks.find((f) => f.id === flockId);
    if (!flock) return 0;
    const lost = mortalities.filter((m) => m.flock_id === flockId).reduce((s, m) => s + m.count, 0);
    return Math.max(0, flock.initial_count - lost);
  };

  // --- Production du mois ---
  const eggEntriesMonth = eggProd.filter((e) => thisMonth(e.production_date || e.created_at));
  const plaquettesMonth = eggEntriesMonth.reduce((s, e) => s + (e.plaquettes || 0), 0);
  const cassesMonth = eggEntriesMonth.reduce((s, e) => s + (e.casses || 0), 0);
  const totalOeufsMonth = plaquettesMonth * PLAQUETTE + cassesMonth;

  const tauxCasse = totalOeufsMonth > 0 ? (cassesMonth / totalOeufsMonth) * 100 : 0;

  const mortThisMonth = mortalities
    .filter((m) => thisMonth(m.mortality_date || m.created_at))
    .reduce((s, m) => s + m.count, 0);
  const totalInitialCount = flocks.reduce((s, f) => s + f.initial_count, 0);
  const tauxMortalite = totalInitialCount > 0 ? (mortThisMonth / totalInitialCount) * 100 : 0;

  const alimentAchats = purchases.filter((p) => p.inputs?.category === "Aliments pour bétail" && thisMonth(p.created_at));
  const kgAlimentAchete = alimentAchats.reduce((s, p) => s + p.quantity, 0);
  const coutAlimentMois = alimentAchats.reduce((s, p) => s + p.total_amount, 0);
  const conversionAlimentaire = totalOeufsMonth > 0 ? (kgAlimentAchete * 1000) / totalOeufsMonth : 0;

  const totalHensNow = flocks
    .filter((f) => f.status === "laying")
    .reduce((s, f) => s + activeHensOf(f.id), 0);
  const daysElapsed = now.getDate();
  const layingRate = totalHensNow > 0 && daysElapsed > 0 ? (totalOeufsMonth / (totalHensNow * daysElapsed)) * 100 : 0;

  // --- Coût de revient complet par plaquette ---
  const coutSanteMois = purchases
    .filter((p) => p.inputs?.category === "Santé animale" && thisMonth(p.created_at))
    .reduce((s, p) => s + p.total_amount, 0);

  const totalInvestSouches = purchases
    .filter((p) => p.inputs?.category === "Souches")
    .reduce((s, p) => s + p.total_amount, 0);
  const amortissementMensuel = totalInvestSouches / AMORTIZATION_MONTHS;

  const coutRevientTotalMois = coutAlimentMois + coutSanteMois + amortissementMensuel;
  const coutRevientParPlaquette = plaquettesMonth > 0 ? coutRevientTotalMois / plaquettesMonth : 0;

  const eggSalesMonth = saleItems.filter(
    (si) => si.sales?.created_at && thisMonth(si.sales.created_at) && si.products?.name === EGG_PRODUCT
  );
  const plaquettesVendues = eggSalesMonth.reduce((s, si) => s + si.quantity, 0);
  const revenuOeufs = eggSalesMonth.reduce((s, si) => s + si.quantity * si.unit_price, 0);
  const prixVenteMoyen = plaquettesVendues > 0 ? revenuOeufs / plaquettesVendues : 0;
  const margeParPlaquette = prixVenteMoyen - coutRevientParPlaquette;

  // --- Comparatif par lot ---
  const flockStats = flocks.map((f) => {
    const entries = eggProd.filter((e) => e.flock_id === f.id && thisMonth(e.production_date || e.created_at));
    const plq = entries.reduce((s, e) => s + (e.plaquettes || 0), 0);
    const cas = entries.reduce((s, e) => s + (e.casses || 0), 0);
    const totalOeufsLot = plq * PLAQUETTE + cas;
    const activeHens = activeHensOf(f.id);
    const rate = activeHens > 0 && daysElapsed > 0 ? (totalOeufsLot / (activeHens * daysElapsed)) * 100 : 0;
    const casseRate = totalOeufsLot > 0 ? (cas / totalOeufsLot) * 100 : 0;
    const mortLot = mortalities.filter((m) => m.flock_id === f.id).reduce((s, m) => s + m.count, 0);
    const mortRateCumul = f.initial_count > 0 ? (mortLot / f.initial_count) * 100 : 0;
    return { id: f.id, name: f.name, activeHens, layingRate: rate, casseRate, mortRateCumul };
  });

  // --- Tendance 6 derniers mois (taux de ponte / taux de casse) ---
  const trend: { name: string; ponte: number; casse: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const pred = (iso: string) => {
      const dd = new Date(iso);
      return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth();
    };
    const monthEntries = eggProd.filter((e) => pred(e.production_date || e.created_at));
    const plq = monthEntries.reduce((s, e) => s + (e.plaquettes || 0), 0);
    const cas = monthEntries.reduce((s, e) => s + (e.casses || 0), 0);
    const totalOeufs = plq * PLAQUETTE + cas;
    const daysInThatMonth =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        ? daysElapsed
        : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const ponteRate = totalHensNow > 0 && daysInThatMonth > 0 ? (totalOeufs / (totalHensNow * daysInThatMonth)) * 100 : 0;
    const casseRate = totalOeufs > 0 ? (cas / totalOeufs) * 100 : 0;
    trend.push({
      name: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      ponte: Number(ponteRate.toFixed(1)),
      casse: Number(casseRate.toFixed(1)),
    });
  }

  // --- Dépenses par catégorie ---
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
    const current = expenses.filter((e) => e.category === cat && thisMonth(e.created_at)).reduce((s, e) => s + e.amount, 0);
    const previous = expenses.filter((e) => e.category === cat && lastMonth(e.created_at)).reduce((s, e) => s + e.amount, 0);
    const variation = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    return { cat, label: categoryLabels[cat], current, previous, variation };
  });

  // --- Alertes ---
  const alerts: { level: "danger" | "warning"; text: string }[] = [];
  if (totalOeufsMonth > 0 && tauxCasse > 3) {
    alerts.push({ level: "danger", text: `Taux de casse élevé (${tauxCasse.toFixed(1)}%) — vérifie la manipulation et le stockage des œufs.` });
  }
  if (totalInitialCount > 0 && tauxMortalite > 2) {
    alerts.push({ level: "danger", text: `Taux de mortalité élevé ce mois (${tauxMortalite.toFixed(1)}%) — vérifie la santé du cheptel.` });
  }
  if (conversionAlimentaire > 0 && conversionAlimentaire > 130) {
    alerts.push({ level: "warning", text: `Conversion alimentaire élevée (${conversionAlimentaire.toFixed(0)}g d'aliment par œuf).` });
  }
  if (prixVenteMoyen > 0 && coutRevientParPlaquette > 0 && margeParPlaquette <= 0) {
    alerts.push({ level: "danger", text: `Marge négative ou nulle par plaquette (coût de revient ${fmt(coutRevientParPlaquette)} ≥ prix de vente ${fmt(prixVenteMoyen)}).` });
  }
  expenseComparison.forEach((c) => {
    if (c.previous > 0 && c.variation > 20) {
      alerts.push({ level: "warning", text: `Dépenses "${c.label}" en hausse de ${c.variation.toFixed(0)}% par rapport au mois dernier.` });
    }
  });
  flockStats.forEach((f) => {
    if (f.mortRateCumul > 8) {
      alerts.push({ level: "warning", text: `${f.name} : mortalité cumulée élevée (${f.mortRateCumul.toFixed(1)}%) depuis sa création.` });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Optimisation</h1>
        <p className="text-sm text-gray-500">Réduis les pertes et optimise tes coûts pour produire plus, en dépensant moins.</p>
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
                    a.level === "danger" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
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
              <p className={`text-lg font-bold ${tauxCasse > 3 ? "text-red-600" : "text-gray-800"}`}>{tauxCasse.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-400">Norme : &lt; 3%</p>
            </div>
            <div className="stat-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <Skull size={15} className={tauxMortalite > 2 ? "text-red-500" : "text-green-600"} />
                <p className="text-xs text-gray-500">Mortalité (mois)</p>
              </div>
              <p className={`text-lg font-bold ${tauxMortalite > 2 ? "text-red-600" : "text-gray-800"}`}>{tauxMortalite.toFixed(1)}%</p>
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

          <div className="stat-card">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Coût de revient complet — Plaquette d'œufs</h2>
            <p className="text-xs text-gray-400 mb-3">
              Aliment + Santé animale + Amortissement de l'achat des poulettes (étalé sur {AMORTIZATION_MONTHS} mois).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Aliment (mois)</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(coutAlimentMois)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Santé animale (mois)</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(coutSanteMois)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Amortissement poulettes</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(amortissementMensuel)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Total (mois)</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(coutRevientTotalMois)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Coût de revient / plaquette</p>
                <p className="text-lg font-bold text-gray-800">{fmt(coutRevientParPlaquette)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Prix de vente moyen</p>
                <p className="text-lg font-bold text-gray-800">{fmt(prixVenteMoyen)}</p>
              </div>
              <div className={`rounded-lg px-3 py-2 ${margeParPlaquette > 0 ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-xs text-gray-500">Marge estimée / plaquette</p>
                <p className={`text-lg font-bold ${margeParPlaquette > 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(margeParPlaquette)}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">Comparatif par lot — ce mois-ci</h2>
            {flockStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucun lot enregistré.</p>
            ) : (
              <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">Lot</th>
                    <th className="pb-2 pr-4 font-medium text-right">Effectif actif</th>
                    <th className="pb-2 pr-4 font-medium text-right">Taux de ponte</th>
                    <th className="pb-2 pr-4 font-medium text-right">Taux de casse</th>
                    <th className="pb-2 font-medium text-right">Mortalité cumulée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {flockStats.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2 pr-4 font-medium text-gray-800">{f.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{f.activeHens.toLocaleString("fr-FR")}</td>
                      <td className={`py-2 pr-4 text-right font-medium ${f.layingRate >= 80 ? "text-green-600" : f.layingRate >= 65 ? "text-amber-600" : "text-red-600"}`}>
                        {f.layingRate.toFixed(1)}%
                      </td>
                      <td className={`py-2 pr-4 text-right font-medium ${f.casseRate > 3 ? "text-red-600" : "text-gray-700"}`}>
                        {f.casseRate.toFixed(1)}%
                      </td>
                      <td className={`py-2 text-right font-medium ${f.mortRateCumul > 8 ? "text-red-600" : "text-gray-700"}`}>
                        {f.mortRateCumul.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="stat-card">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Tendance — 6 derniers mois</h2>
            <p className="text-xs text-gray-400 mb-3">Taux de ponte et taux de casse, mois par mois.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ponte" name="Taux de ponte" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="casse" name="Taux de casse" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-1">Dépenses par catégorie — évolution</h2>
            <p className="text-xs text-gray-400 mb-3">
              Comparaison entre {lastMonthDate.toLocaleDateString("fr-FR", { month: "long" })} et {now.toLocaleDateString("fr-FR", { month: "long" })}.
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
