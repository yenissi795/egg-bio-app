import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Eye, FileDown, Calendar, CalendarDays, CalendarRange, Layers, X } from "lucide-react";
import { buildReportDoc } from "../lib/reportPdf";
import type { IndicatorRow, InventoryRow } from "../lib/reportPdf";
import { useSettings, useCurrencyFormatter } from "../context/SettingsContext";
import logoImg from "../assets/logo.png";

type PeriodType = "day" | "month" | "year" | "all";

const reportTypes: { key: PeriodType; title: string; sub: string; icon: any }[] = [
  { key: "day", title: "Rapport journalier", sub: "Activité du jour en cours", icon: Calendar },
  { key: "month", title: "Rapport mensuel", sub: "Synthèse du mois courant", icon: CalendarDays },
  { key: "year", title: "Rapport annuel", sub: "Bilan de l'année en cours", icon: CalendarRange },
  { key: "global", title: "Rapport global", sub: "Toutes les données enregistrées", icon: Layers } as any,
];

export default function ReportsPage() {
  const { companyName, subtitle, phone, address } = useSettings();
  const fmt = useCurrencyFormatter();
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashTx, setCashTx] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [preview, setPreview] = useState<{ title: string; periodLabel: string; indicators: IndicatorRow[] } | null>(
    null
  );

  const load = async () => {
    setLoading(true);
    const [
      { data: salesData },
      { data: purchasesData },
      { data: expensesData },
      { data: cashData },
      { data: productsData },
      { data: clientsData },
    ] = await Promise.all([
      supabase.from("sales").select("id, total_amount, amount_paid, created_at"),
      supabase.from("purchases").select("id, total_amount, amount_paid, created_at, source"),
      supabase.from("expenses").select("id, amount, source, created_at"),
      supabase.from("cash_transactions").select("*"),
      supabase.from("products").select("id, name, category, unit, cost_price, sale_price, quantity"),
      supabase.from("clients").select("id"),
    ]);
    setSales(salesData || []);
    setPurchases(purchasesData || []);
    setExpenses(expensesData || []);
    setCashTx(cashData || []);
    setProducts(productsData || []);
    setClients(clientsData || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const isSameDay = (iso: string) => iso.slice(0, 10) === now.toISOString().slice(0, 10);
  const isSameMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const isSameYear = (iso: string) => new Date(iso).getFullYear() === now.getFullYear();

  // --- Indicateurs "état actuel" (toujours identiques, quel que soit le rapport) ---
  const capital = cashTx.filter((t) => t.type === "injection").reduce((s, t) => s + t.amount, 0);
  const salesTotalPaid = sales.reduce((s, v) => s + v.amount_paid, 0);
  const caisse =
    salesTotalPaid +
    cashTx.filter((t) => t.type === "injection" || t.type === "epargne_retrait").reduce((s, t) => s + t.amount, 0) -
    cashTx.filter((t) => t.type === "decaissement" || t.type === "epargne_depot").reduce((s, t) => s + t.amount, 0);
  const banque =
    cashTx.filter((t) => t.type === "epargne_depot").reduce((s, t) => s + t.amount, 0) -
    cashTx.filter((t) => t.type === "epargne_retrait").reduce((s, t) => s + t.amount, 0);
  const dettesFournisseurs = purchases.reduce((s, p) => s + Math.max(0, p.total_amount - p.amount_paid), 0);
  const creancesClients = sales.reduce((s, v) => s + Math.max(0, v.total_amount - v.amount_paid), 0);
  const valeurStockAchat = products.reduce((s, p) => s + p.cost_price * p.quantity, 0);
  const nbProduits = products.length;
  const stockFaible = products.filter((p) => p.quantity < 5).length;

  const buildIndicators = (period: PeriodType): { indicators: IndicatorRow[]; periodLabel: string } => {
    const predicate =
      period === "day" ? isSameDay : period === "month" ? isSameMonth : period === "year" ? isSameYear : () => true;

    const ca = sales.filter((s) => predicate(s.created_at)).reduce((s, v) => s + v.total_amount, 0);
    const ach = purchases
      .filter((p) => predicate(p.created_at) && p.source === "benefice")
      .reduce((s, p) => s + p.total_amount, 0);
    const dep = expenses
      .filter((e) => predicate(e.created_at) && e.source === "benefice")
      .reduce((s, e) => s + e.amount, 0);
    const benefice = ca - ach - dep;
    const nbVentes = sales.filter((s) => predicate(s.created_at)).length;

    const periodLabel =
      period === "day"
        ? `Du ${now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`
        : period === "month"
        ? `Mois de ${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
        : period === "year"
        ? `Année ${now.getFullYear()}`
        : "Toutes périodes confondues";

    const indicators: IndicatorRow[] = [
      { label: "Chiffre d'affaires", value: fmt(ca) },
      { label: "Bénéfice", value: fmt(benefice) },
      { label: "Capital", value: fmt(capital) },
      { label: "Caisse", value: fmt(caisse) },
      { label: "Banque", value: fmt(banque) },
      { label: "Dettes fournisseurs", value: fmt(dettesFournisseurs) },
      { label: "Créances clients", value: fmt(creancesClients) },
      { label: "Valeur stock (achat)", value: fmt(valeurStockAchat) },
      { label: "Nb produits", value: String(nbProduits) },
      { label: "Stock faible (<5)", value: String(stockFaible) },
      { label: "Nb ventes (période)", value: String(nbVentes) },
      { label: "Nb clients", value: String(clients.length) },
    ];

    return { indicators, periodLabel };
  };

  // Retire les caractères que la police du PDF ne rend pas correctement
  // (espace insécable des nombres, ligature "œ"/"Œ").
  const pdfSafe = (s: string) => s.replace(/\u00A0/g, " ").replace(/œ/g, "oe").replace(/Œ/g, "Oe");
  const numSafe = (n: number) => n.toLocaleString("fr-FR").replace(/[\u00A0\u202F\u2009]/g, " ");

  const buildInventory = (): InventoryRow[] =>
    products.map((p) => ({
      type: pdfSafe(p.category),
      product: pdfSafe(p.name),
      unit: pdfSafe(p.unit),
      costPrice: numSafe(p.cost_price),
      salePrice: numSafe(p.sale_price),
      stock: String(p.quantity),
    }));

  const titleFor = (period: PeriodType) => {
    if (period === "day") return "Rapport journalier";
    if (period === "month") return "Rapport mensuel";
    if (period === "year") return "Rapport annuel";
    return "Rapport global";
  };

  const handlePreview = (period: PeriodType) => {
    const { indicators, periodLabel } = buildIndicators(period);
    setPreview({ title: titleFor(period), periodLabel, indicators });
  };

  const handleDownload = async (period: PeriodType) => {
    const { indicators, periodLabel } = buildIndicators(period);
    const inventory = buildInventory();
    const doc = await buildReportDoc({
      title: titleFor(period),
      periodLabel,
      indicators,
      inventory,
      company: { name: companyName, subtitle, phone, address, logoUrl: logoImg },
    });
    const dateSuffix = now.toISOString().slice(0, 10);
    doc.save(`${companyName.replace(/\s/g, "_")}_${titleFor(period).replace(/\s/g, "_")}_${dateSuffix}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Rapports PDF</h1>
        <p className="text-sm text-gray-500">Générez et téléchargez vos rapports d'activité au format PDF.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reportTypes.map((r) => (
            <div key={r.key} className="stat-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <r.icon size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{r.title}</p>
                  <p className="text-xs text-gray-500">{r.sub}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handlePreview(r.key as PeriodType)}
                  className="flex items-center gap-1 text-xs font-medium bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2"
                >
                  <Eye size={14} />
                  Aperçu
                </button>
                <button
                  onClick={() => handleDownload(r.key as PeriodType)}
                  className="flex items-center gap-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2"
                >
                  <FileDown size={14} />
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{preview.title}</h2>
                <p className="text-xs text-gray-500">{preview.periodLabel}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {preview.indicators.map((ind) => (
                <div key={ind.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-gray-500">{ind.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{ind.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
