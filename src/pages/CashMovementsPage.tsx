import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { Wallet, PiggyBank } from "lucide-react";

interface CashTransaction {
  id: string;
  type: "injection" | "decaissement" | "epargne_depot" | "epargne_retrait";
  amount: number;
  reason: string | null;
  transaction_date: string;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  injection: "Fonds injectés",
  decaissement: "Décaissement",
  epargne_depot: "Mise en épargne",
  epargne_retrait: "Retrait d'épargne",
};

export default function CashMovementsPage() {
  const fmt = useCurrencyFormatter();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState<"fonds" | "epargne" | null>(null);
  const [fondsDirection, setFondsDirection] = useState<"injection" | "decaissement">("injection");
  const [epargneDirection, setEpargneDirection] = useState<"epargne_depot" | "epargne_retrait">("epargne_depot");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cash_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions((data as CashTransaction[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Ouvre automatiquement le bon formulaire selon la tuile cliquée depuis l'accueil
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "fonds") {
      setFondsDirection("injection");
      setShowForm("fonds");
    } else if (mode === "epargne") {
      setEpargneDirection("epargne_depot");
      setShowForm("epargne");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resetForm = () => {
    setAmount("");
    setReason("");
    setTxDate(new Date().toISOString().slice(0, 10));
    setErrors({});
    setShowForm(null);
  };

  const openFonds = () => {
    setFondsDirection("injection");
    setShowForm("fonds");
  };

  const openEpargne = () => {
    setEpargneDirection("epargne_depot");
    setShowForm("epargne");
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!amount) newErrors.amount = "Ce champ est obligatoire.";
    if (!txDate) newErrors.txDate = "Ce champ est obligatoire.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const type = showForm === "fonds" ? fondsDirection : epargneDirection;

    setSaving(true);
    await supabase.from("cash_transactions").insert({
      type,
      amount: Number(amount),
      reason: reason.trim() || null,
      transaction_date: txDate,
      owner_id: user?.id,
    });
    setSaving(false);
    resetForm();
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Fonds &amp; Épargne</h1>
        <p className="text-sm text-gray-500">Enregistre les mouvements de trésorerie personnelle.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={openFonds}
          className={`stat-card !p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow ${
            showForm === "fonds" ? "ring-2 ring-green-500" : ""
          }`}
        >
          <Wallet size={22} className="text-green-600" />
          <span className="text-sm font-medium text-gray-700">Fonds / Décaissement</span>
        </button>
        <button
          onClick={openEpargne}
          className={`stat-card !p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow ${
            showForm === "epargne" ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <PiggyBank size={22} className="text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Épargne / Retrait</span>
        </button>
      </div>

      {showForm && (
        <div className="stat-card space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">
            {showForm === "fonds" ? "Fonds / Décaissement" : "Épargne / Retrait"}
          </h2>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Type de mouvement</label>
            {showForm === "fonds" ? (
              <select
                value={fondsDirection}
                onChange={(e) => setFondsDirection(e.target.value as "injection" | "decaissement")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="injection">Injection de fonds (entrée)</option>
                <option value="decaissement">Décaissement (sortie)</option>
              </select>
            ) : (
              <select
                value={epargneDirection}
                onChange={(e) => setEpargneDirection(e.target.value as "epargne_depot" | "epargne_retrait")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="epargne_depot">Mise en épargne</option>
                <option value="epargne_retrait">Retrait de l'épargne</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                placeholder="Montant"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.amount ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.txDate ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.txDate && <p className="text-xs text-red-600 mt-1">{errors.txDate}</p>}
            </div>
          </div>

          <input
            placeholder="Motif (optionnel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={resetForm}
              className="text-sm text-gray-500 hover:bg-gray-100 rounded-lg px-4 py-2"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des mouvements</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun mouvement pour l'instant.</p>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium text-right">Montant</th>
                <th className="pb-2 pr-4 font-medium">Motif</th>
                <th className="pb-2 font-medium">Date / Heure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((t) => {
                const isPositive = t.type === "injection" || t.type === "epargne_retrait";
                return (
                  <tr key={t.id}>
                    <td className="py-2 pr-4 text-gray-800 font-medium">{typeLabels[t.type]}</td>
                    <td className={`py-2 pr-4 text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : "-"}
                      {fmt(t.amount)}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{t.reason || "—"}</td>
                    <td className="py-2 text-gray-500 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
