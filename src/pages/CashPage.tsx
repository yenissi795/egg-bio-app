import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import {
  DollarSign,
  TrendingUp,
  Coins,
  Wallet,
  Landmark,
  ShoppingCart,
  Receipt,
  AlertTriangle,
} from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);
const isToday = (iso: string) => iso.slice(0, 10) === todayStr();

export default function CashPage() {
  const fmt = useCurrencyFormatter();
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashTx, setCashTx] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { data: salesData },
      { data: purchasesData },
      { data: expensesData },
      { data: cashData },
      { data: productsData },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, invoice_number, total_amount, amount_paid, payment_status, created_at, clients(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("id, total_amount, amount_paid, purchase_date, created_at, inputs(category)")
        .order("created_at", { ascending: false }),
      supabase.from("expenses").select("id, amount, expense_date, created_at, source"),
      supabase.from("cash_transactions").select("*"),
      supabase.from("products").select("id, name, category, unit, quantity").order("quantity"),
    ]);
    setSales(salesData || []);
    setPurchases(purchasesData || []);
    setExpenses(expensesData || []);
    setCashTx(cashData || []);
    setProducts(productsData || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // --- Indicateurs principaux ---
  const chiffreAffaires = sales.reduce((s, v) => s + v.total_amount, 0);

  const totalAchats = purchases.reduce((s, p) => s + p.total_amount, 0);
  const depensesSurBenefice = expenses.filter((e) => e.source === "benefice").reduce((s, e) => s + e.amount, 0);
  const benefice = chiffreAffaires - totalAchats - depensesSurBenefice;

  const capital = cashTx
    .filter((t) => t.type === "injection")
    .reduce((s, t) => s + t.amount, 0);

  const salesTotalPaid = sales.reduce((s, v) => s + v.amount_paid, 0);
  const caisse =
    salesTotalPaid +
    cashTx.filter((t) => t.type === "injection" || t.type === "epargne_retrait").reduce((s, t) => s + t.amount, 0) -
    cashTx.filter((t) => t.type === "decaissement" || t.type === "epargne_depot").reduce((s, t) => s + t.amount, 0);

  const banque =
    cashTx.filter((t) => t.type === "epargne_depot").reduce((s, t) => s + t.amount, 0) -
    cashTx.filter((t) => t.type === "epargne_retrait").reduce((s, t) => s + t.amount, 0);

  // --- Indicateurs du jour ---
  const ventesDuJour = sales.filter((v) => isToday(v.created_at)).length;
  const encaissementsDuJour = sales
    .filter((v) => isToday(v.created_at))
    .reduce((s, v) => s + v.amount_paid, 0);
  const depensesDuJour = expenses
    .filter((e) => isToday(e.created_at))
    .reduce((s, e) => s + e.amount, 0);

  const creancesClients = sales.reduce((s, v) => s + Math.max(0, v.total_amount - v.amount_paid), 0);
  const dettesFournisseurs = purchases.reduce((s, p) => s + Math.max(0, p.total_amount - p.amount_paid), 0);

  // --- Achats par catégorie ---
  const achatsParCategorie: Record<string, { count: number; total: number }> = {};
  purchases.forEach((p) => {
    const cat = p.inputs?.category || "Autre";
    if (!achatsParCategorie[cat]) achatsParCategorie[cat] = { count: 0, total: 0 };
    achatsParCategorie[cat].count += 1;
    achatsParCategorie[cat].total += p.total_amount;
  });

  const lowStockProducts = products.filter((p) => p.quantity < 5);
  const recentSales = sales.slice(0, 5);

  const mainCards = [
    { key: "revenue", label: "Chiffre d'affaires", value: chiffreAffaires, icon: DollarSign, bg: "bg-green-50" },
    { key: "profit", label: "Bénéfice", value: benefice, icon: TrendingUp, bg: "bg-green-50" },
    { key: "capital", label: "Capital", value: capital, icon: Coins, bg: "bg-amber-50" },
    { key: "cash", label: "Caisse", value: caisse, icon: Wallet, bg: "bg-gray-50" },
    { key: "bank", label: "Banque", value: banque, icon: Landmark, bg: "bg-gray-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Grande caisse</h1>
        <p className="text-sm text-gray-500">Vue d'ensemble de la trésorerie et des finances.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mainCards.map((c) => (
              <div key={c.key} className={`stat-card ${c.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                    <c.icon size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-lg font-bold text-gray-800">{fmt(c.value)}</p>
                  </div>
                </div>
                <Link
                  to={`/caisse/details/${c.key}`}
                  className="inline-flex items-center gap-1 text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  Détails →
                </Link>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="stat-card flex items-center gap-3">
              <ShoppingCart size={20} className="text-green-600" />
              <div>
                <p className="text-xs text-gray-500">Ventes du jour</p>
                <p className="text-lg font-bold text-gray-800">{ventesDuJour}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <DollarSign size={20} className="text-green-600" />
              <div>
                <p className="text-xs text-gray-500">Encaissements du jour</p>
                <p className="text-lg font-bold text-gray-800">{fmt(encaissementsDuJour)}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <Receipt size={20} className="text-red-500" />
              <div>
                <p className="text-xs text-gray-500">Dépenses du jour</p>
                <p className="text-lg font-bold text-gray-800">{fmt(depensesDuJour)}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <DollarSign size={20} className="text-amber-600" />
              <div>
                <p className="text-xs text-gray-500">Créances clients</p>
                <p className="text-lg font-bold text-gray-800">{fmt(creancesClients)}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <Coins size={20} className="text-amber-600" />
              <div>
                <p className="text-xs text-gray-500">Dettes fournisseurs</p>
                <p className="text-lg font-bold text-gray-800">{fmt(dettesFournisseurs)}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700 text-sm">Achats — par catégorie</h2>
              <span className="text-xs text-gray-400">
                {purchases.length} achats · {fmt(totalAchats)}
              </span>
            </div>
            {Object.keys(achatsParCategorie).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucun achat enregistré.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(achatsParCategorie).map(([cat, v]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-medium text-gray-800">
                      {v.count} achat{v.count > 1 ? "s" : ""} · {fmt(v.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="font-semibold text-gray-700 text-sm">Produits en stock faible (&lt; 5)</h2>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Aucun produit en stock faible.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {p.name} <span className="text-gray-400">({p.unit})</span> —{" "}
                      <span className="text-gray-500">{p.category}</span>
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        p.quantity === 0 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"
                      }`}
                    >
                      {p.quantity === 0 ? "RUPTURE" : "STOCK FAIBLE"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stat-card">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">Ventes récentes</h2>
            {recentSales.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune vente enregistrée.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentSales.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{s.invoice_number}</p>
                      <p className="text-xs text-gray-500">{s.clients?.name || "—"}</p>
                    </div>
                    <span className="font-medium text-gray-800">{fmt(s.total_amount)}</span>
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
