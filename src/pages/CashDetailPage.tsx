import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const fmt = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const typeConfig: Record<string, { title: string }> = {
  revenue: { title: "Chiffre d'affaires" },
  profit: { title: "Bénéfice" },
  capital: { title: "Capital" },
  cash: { title: "Caisse" },
  bank: { title: "Banque" },
};

const monthLabel = (d: Date) =>
  d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");

export default function CashDetailPage() {
  const { type } = useParams<{ type: string }>();
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashTx, setCashTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: salesData }, { data: purchasesData }, { data: expensesData }, { data: cashData }] =
      await Promise.all([
        supabase
          .from("sales")
          .select("id, invoice_number, total_amount, amount_paid, created_at, clients(name)")
          .order("created_at", { ascending: false }),
        supabase.from("purchases").select("id, total_amount, created_at"),
        supabase.from("expenses").select("id, amount, created_at, source"),
        supabase.from("cash_transactions").select("*").order("created_at", { ascending: false }),
      ]);
    setSales(salesData || []);
    setPurchases(purchasesData || []);
    setExpenses(expensesData || []);
    setCashTx(cashData || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = (iso: string) => iso.slice(0, 10) === todayStr;
  const isThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const isThisYear = (iso: string) => new Date(iso).getFullYear() === now.getFullYear();
  const yearOf = (iso: string) => new Date(iso).getFullYear();

  type Point = { date: string; amount: number; label: string };
  let points: Point[] = [];
  let historyRows: { label: string; sub: string; amount: number; date: string }[] = [];

  if (type === "revenue") {
    points = sales.map((s) => ({ date: s.created_at, amount: s.total_amount, label: s.invoice_number }));
    historyRows = sales.map((s) => ({
      label: s.invoice_number,
      sub: s.clients?.name || "—",
      amount: s.total_amount,
      date: s.created_at,
    }));
  } else if (type === "capital") {
    const injections = cashTx.filter((t) => t.type === "injection");
    points = injections.map((t) => ({ date: t.created_at, amount: t.amount, label: "Injection" }));
    historyRows = injections.map((t) => ({
      label: "Fonds injectés",
      sub: t.reason || "—",
      amount: t.amount,
      date: t.created_at,
    }));
  } else if (type === "bank") {
    const relevant = cashTx.filter((t) => t.type === "epargne_depot" || t.type === "epargne_retrait");
    points = relevant.map((t) => ({
      date: t.created_at,
      amount: t.type === "epargne_depot" ? -t.amount : t.amount,
      label: t.type,
    }));
    const typeLabels: Record<string, string> = {
      epargne_depot: "Mise en épargne",
      epargne_retrait: "Retrait d'épargne",
    };
    historyRows = relevant.map((t) => ({
      label: typeLabels[t.type] || t.type,
      sub: t.reason || "—",
      amount: t.type === "epargne_depot" ? -t.amount : t.amount,
      date: t.created_at,
    }));
  } else if (type === "cash") {
    // La Caisse regroupe TOUT ce qui affecte la liquidité disponible :
    // les mouvements de fonds/épargne ET les encaissements de ventes.
    const fundMovements = cashTx.map((t) => ({
      date: t.created_at,
      amount: t.type === "decaissement" || t.type === "epargne_depot" ? -t.amount : t.amount,
      label: t.type,
    }));
    const typeLabels: Record<string, string> = {
      injection: "Fonds injectés",
      decaissement: "Décaissement",
      epargne_depot: "Mise en épargne",
      epargne_retrait: "Retrait d'épargne",
    };
    const fundRows = cashTx.map((t) => ({
      label: typeLabels[t.type] || t.type,
      sub: t.reason || "—",
      amount: t.type === "decaissement" || t.type === "epargne_depot" ? -t.amount : t.amount,
      date: t.created_at,
    }));

    const saleMovements = sales
      .filter((s) => s.amount_paid > 0)
      .map((s) => ({ date: s.created_at, amount: s.amount_paid, label: "Encaissement vente" }));
    const saleRows = sales
      .filter((s) => s.amount_paid > 0)
      .map((s) => ({
        label: `Encaissement — ${s.invoice_number}`,
        sub: s.clients?.name || "—",
        amount: s.amount_paid,
        date: s.created_at,
      }));

    points = [...fundMovements, ...saleMovements];
    historyRows = [...fundRows, ...saleRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  let total = 0;
  let todayTotal = 0;
  let monthTotal = 0;
  let yearTotal = 0;
  const byYear: Record<number, number> = {};

  // --- Monthly profit rows (used both for the chart and the "Historique récent" list) ---
  const monthlyProfitRows: { monthDate: Date; ca: number; charges: number; profit: number }[] = [];

  if (type === "profit") {
    const netFor = (predicate: (iso: string) => boolean) => {
      const rev = sales.filter((s) => predicate(s.created_at)).reduce((s, v) => s + v.total_amount, 0);
      const ach = purchases.filter((p) => predicate(p.created_at)).reduce((s, p) => s + p.total_amount, 0);
      const dep = expenses
        .filter((e) => predicate(e.created_at) && e.source === "benefice")
        .reduce((s, e) => s + e.amount, 0);
      return rev - ach - dep;
    };
    total = netFor(() => true);
    todayTotal = netFor(isToday);
    monthTotal = netFor(isThisMonth);
    yearTotal = netFor(isThisYear);

    const years = new Set<number>();
    [...sales, ...purchases, ...expenses].forEach((r) => years.add(yearOf(r.created_at)));
    years.forEach((y) => {
      byYear[y] = netFor((iso) => yearOf(iso) === y);
    });

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pred = (iso: string) => {
        const dd = new Date(iso);
        return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth();
      };
      const rev = sales.filter((s) => pred(s.created_at)).reduce((s, v) => s + v.total_amount, 0);
      const charges =
        purchases.filter((p) => pred(p.created_at)).reduce((s, p) => s + p.total_amount, 0) +
        expenses
          .filter((e) => pred(e.created_at) && e.source === "benefice")
          .reduce((s, e) => s + e.amount, 0);
      monthlyProfitRows.push({ monthDate: d, ca: rev, charges, profit: rev - charges });
      points.push({ date: d.toISOString(), amount: rev - charges, label: monthLabel(d) });
    }

    historyRows = [...monthlyProfitRows].reverse().map((r) => ({
      label: r.monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      sub: `CA : ${fmt(r.ca)} · Charges : ${fmt(r.charges)}`,
      amount: r.profit,
      date: r.monthDate.toISOString(),
    }));
  } else {
    total = points.reduce((s, p) => s + p.amount, 0);
    todayTotal = points.filter((p) => isToday(p.date)).reduce((s, p) => s + p.amount, 0);
    monthTotal = points.filter((p) => isThisMonth(p.date)).reduce((s, p) => s + p.amount, 0);
    yearTotal = points.filter((p) => isThisYear(p.date)).reduce((s, p) => s + p.amount, 0);
    points.forEach((p) => {
      const y = yearOf(p.date);
      byYear[y] = (byYear[y] || 0) + p.amount;
    });
  }

  // Le "Total" de Caisse/Banque doit être le solde courant (cumulatif), ce qui correspond
  // en réalité exactement à la somme de tous les points (fonds + ventes encaissées pour Caisse,
  // dépôts - retraits pour Banque) — donc déjà cohérent avec le calcul ci-dessus, pas de
  // recalcul séparé nécessaire ici.

  const chartData = (type === "profit" ? points : [...points].reverse())
    .slice(-30)
    .map((p) => ({
      name:
        type === "profit"
          ? p.label
          : new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      valeur: p.amount,
    }));

  const previousYears = Object.entries(byYear)
    .filter(([y]) => Number(y) !== now.getFullYear())
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  const config = typeConfig[type || ""] || { title: "Détails" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/caisse"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <ArrowLeft size={14} />
          Retour
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Détails — {config.title}</h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase mb-3">Évolution dans le temps</p>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                Pas encore de données.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="valeur" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card !p-3">
              <p className="text-xs text-gray-400 uppercase">Total</p>
              <p className="text-lg font-bold text-gray-800">{fmt(total)}</p>
            </div>
            <div className="stat-card !p-3">
              <p className="text-xs text-gray-400 uppercase">Aujourd'hui</p>
              <p className="text-lg font-bold text-gray-800">{fmt(todayTotal)}</p>
            </div>
            <div className="stat-card !p-3">
              <p className="text-xs text-gray-400 uppercase">
                {now.toLocaleDateString("fr-FR", { month: "long" })} (Mois {now.getMonth() + 1})
              </p>
              <p className="text-lg font-bold text-gray-800">{fmt(monthTotal)}</p>
            </div>
            <div className="stat-card !p-3">
              <p className="text-xs text-gray-400 uppercase">Année : {now.getFullYear()}</p>
              <p className="text-lg font-bold text-gray-800">{fmt(yearTotal)}</p>
            </div>
          </div>

          {previousYears.length > 0 && (
            <div className="stat-card">
              <h2 className="font-semibold text-gray-700 text-sm mb-3">Années précédentes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {previousYears.map(([y, v]) => (
                  <div key={y} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Année {y}</p>
                    <p className="text-sm font-semibold text-gray-800">{fmt(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stat-card">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">
              {type === "profit" ? "Historique mensuel" : "Historique récent"}
            </h2>
            {historyRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune opération récente.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {historyRows.slice(0, 30).map((r, i) => (
                  <div key={i} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-800 capitalize">{r.label}</p>
                      <p className="text-xs text-gray-500">
                        {r.sub}
                        {type !== "profit" && ` · ${new Date(r.date).toLocaleString("fr-FR")}`}
                      </p>
                    </div>
                    <span className={`font-medium ${r.amount < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {r.amount < 0 ? "-" : ""}
                      {fmt(Math.abs(r.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
