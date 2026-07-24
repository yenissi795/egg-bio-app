import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { Plus, Receipt, X, Trash2 } from "lucide-react";

interface Expense {
  id: string;
  category: string;
  reason: string;
  amount: number;
  payment_method: string;
  source: string;
  supplier_name: string | null;
  receipt: string | null;
  notes: string | null;
  expense_date: string;
  created_at: string;
}

const categories = [
  { value: "maintenance", label: "Maintenance" },
  { value: "entretien", label: "Entretien" },
  { value: "exploitation", label: "Exploitation" },
  { value: "personnel", label: "Personnel" },
  { value: "transport", label: "Transport" },
  { value: "administration", label: "Administration" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.value, c.label])
);

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
];

const paymentMethodLabels: Record<string, string> = Object.fromEntries(
  paymentMethods.map((p) => [p.value, p.label])
);

const sourceOptions = [
  { value: "caisse", label: "Caisse (n'affecte pas le bénéfice)" },
  { value: "benefice", label: "Bénéfice (déduit comme charge)" },
];

const sourceLabels: Record<string, string> = {
  caisse: "Caisse",
  benefice: "Bénéfice",
};

export default function ExpensesPage() {
  const fmt = useCurrencyFormatter();
  const { user } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(categories[0].value);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [source, setSource] = useState("caisse");
  const [supplierName, setSupplierName] = useState("");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setCategory(categories[0].value);
    setReason("");
    setAmount("");
    setPaymentMethod("cash");
    setSource("caisse");
    setSupplierName("");
    setReceipt("");
    setNotes("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setErrors({});
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!reason.trim()) newErrors.reason = "Ce champ est obligatoire.";
    if (!amount) newErrors.amount = "Ce champ est obligatoire.";
    if (!expenseDate) newErrors.expenseDate = "Ce champ est obligatoire.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    await supabase.from("expenses").insert({
      category,
      reason: reason.trim(),
      amount: Number(amount),
      payment_method: paymentMethod,
      source,
      supplier_name: supplierName.trim() || null,
      receipt: receipt.trim() || null,
      notes: notes.trim() || null,
      expense_date: expenseDate,
      owner_id: user?.id,
    });
    setSaving(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setConfirmDeleteId(null);
    load();
  };

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  const now = new Date();
  const monthTotal = expenses
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  const yearTotal = expenses
    .filter((e) => new Date(e.expense_date).getFullYear() === now.getFullYear())
    .reduce((s, e) => s + e.amount, 0);

  const byCategory = categories.map((c) => ({
    ...c,
    total: expenses.filter((e) => e.category === c.value).reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dépenses</h1>
          <p className="text-sm text-gray-500">Suivi des charges de l'exploitation.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouvelle dépense
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Total</p>
          <p className="text-xl font-bold text-gray-800">{fmt(totalAmount)}</p>
        </div>
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Ce mois-ci</p>
          <p className="text-xl font-bold text-gray-800">{fmt(monthTotal)}</p>
        </div>
        <div className="stat-card !p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 uppercase">Cette année</p>
          <p className="text-xl font-bold text-gray-800">{fmt(yearTotal)}</p>
        </div>
      </div>

      <div className="stat-card">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Répartition par catégorie</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {byCategory.map((c) => (
            <div key={c.value} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-sm font-semibold text-gray-800">{fmt(c.total)}</p>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="stat-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Nouvelle dépense</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Mode de paiement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {paymentMethods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Source de financement
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {sourceOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              "Caisse" : sortie d'argent qui n'affecte pas le Bénéfice affiché. "Bénéfice" : cette
              dépense est déduite comme une charge d'exploitation.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Libellé</label>
            <input
              placeholder="Ex: Réparation clôture poulailler"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                errors.reason ? "border-red-400" : "border-gray-200"
              }`}
            />
            {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Montant</label>
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
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.expenseDate ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.expenseDate && (
                <p className="text-xs text-red-600 mt-1">{errors.expenseDate}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Fournisseur (optionnel)"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="N° pièce justificative (optionnel)"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <input
            placeholder="Observations (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer la dépense"}
          </button>
        </div>
      )}

      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des dépenses</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <Receipt size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Aucune dépense pour l'instant.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Catégorie</th>
                <th className="pb-2 pr-4 font-medium">Libellé</th>
                <th className="pb-2 pr-4 font-medium text-right">Montant</th>
                <th className="pb-2 pr-4 font-medium">Paiement</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Date / Heure</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {categoryLabels[e.category]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-800">{e.reason}</td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-800">{fmt(e.amount)}</td>
                  <td className="py-2 pr-4 text-gray-500">{paymentMethodLabels[e.payment_method]}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        e.source === "benefice" ? "text-red-600 bg-red-50" : "text-gray-600 bg-gray-100"
                      }`}
                    >
                      {sourceLabels[e.source] || e.source}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === e.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg px-2 py-1"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(e.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
