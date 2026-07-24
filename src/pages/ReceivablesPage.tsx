import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { DollarSign, Coins, X } from "lucide-react";

interface SaleReceivable {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  clients: { name: string } | null;
}

interface PurchaseDebt {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  suppliers: { name: string } | null;
  inputs: { name: string } | null;
}

export default function ReceivablesPage() {
  const fmt = useCurrencyFormatter();
  const [sales, setSales] = useState<SaleReceivable[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"clients" | "fournisseurs">("clients");

  const [payTarget, setPayTarget] = useState<{ type: "sale" | "purchase"; id: string; max: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState("");
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: salesData }, { data: purchasesData }] = await Promise.all([
      supabase
        .from("sales")
        .select("id, invoice_number, total_amount, amount_paid, created_at, clients(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("id, invoice_number, total_amount, amount_paid, created_at, suppliers(name), inputs(name)")
        .order("created_at", { ascending: false }),
    ]);
    setSales(((salesData as unknown as SaleReceivable[]) || []).filter((s) => s.amount_paid < s.total_amount));
    setPurchases(
      ((purchasesData as unknown as PurchaseDebt[]) || []).filter((p) => p.amount_paid < p.total_amount)
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalCreances = sales.reduce((s, v) => s + (v.total_amount - v.amount_paid), 0);
  const totalDettes = purchases.reduce((s, p) => s + (p.total_amount - p.amount_paid), 0);

  const openPay = (type: "sale" | "purchase", id: string, max: number) => {
    setPayTarget({ type, id, max });
    setPayAmount("");
    setPayError("");
  };

  const closePay = () => {
    setPayTarget(null);
    setPayAmount("");
    setPayError("");
  };

  const handlePay = async () => {
    if (!payTarget) return;
    if (!payAmount) {
      setPayError("Ce champ est obligatoire.");
      return;
    }
    const amount = Number(payAmount);
    if (amount <= 0) {
      setPayError("Le montant doit être supérieur à 0.");
      return;
    }
    if (amount > payTarget.max) {
      setPayError(`Le montant ne peut pas dépasser le reste dû (${fmt(payTarget.max)}).`);
      return;
    }

    setPaying(true);
    const table = payTarget.type === "sale" ? "sales" : "purchases";
    const current =
      payTarget.type === "sale"
        ? sales.find((s) => s.id === payTarget.id)
        : purchases.find((p) => p.id === payTarget.id);

    if (current) {
      const newAmountPaid = current.amount_paid + amount;
      const updatePayload: Record<string, unknown> = { amount_paid: newAmountPaid };
      if (payTarget.type === "sale") {
        updatePayload.payment_status =
          newAmountPaid >= current.total_amount ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid";
      }
      await supabase.from(table).update(updatePayload).eq("id", payTarget.id);
    }

    setPaying(false);
    closePay();
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Créances &amp; Dettes</h1>
        <p className="text-sm text-gray-500">Suivi des paiements en attente, clients et fournisseurs.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="stat-card flex items-center gap-3">
          <DollarSign size={22} className="text-amber-600" />
          <div>
            <p className="text-xs text-gray-500">Total créances clients</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalCreances)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Coins size={22} className="text-amber-600" />
          <div>
            <p className="text-xs text-gray-500">Total dettes fournisseurs</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalDettes)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("clients")}
          className={`flex-1 text-sm font-medium rounded-lg py-2 ${
            tab === "clients" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
          }`}
        >
          Créances clients ({sales.length})
        </button>
        <button
          onClick={() => setTab("fournisseurs")}
          className={`flex-1 text-sm font-medium rounded-lg py-2 ${
            tab === "fournisseurs" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
          }`}
        >
          Dettes fournisseurs ({purchases.length})
        </button>
      </div>

      {payTarget && (
        <div className="stat-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Enregistrer un paiement</h2>
            <button onClick={closePay} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500">Reste dû : {fmt(payTarget.max)}</p>
          <div>
            <input
              type="number"
              placeholder="Montant payé"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                payError ? "border-red-400" : "border-gray-200"
              }`}
            />
            {payError && <p className="text-xs text-red-600 mt-1">{payError}</p>}
          </div>
          <button
            onClick={handlePay}
            disabled={paying}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {paying ? "Enregistrement..." : "Enregistrer le paiement"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : tab === "clients" ? (
        <div className="stat-card overflow-x-auto">
          {sales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune créance en cours.</p>
          ) : (
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Facture</th>
                  <th className="pb-2 pr-4 font-medium">Client</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium text-right">Payé</th>
                  <th className="pb-2 pr-4 font-medium text-right">Reste dû</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => {
                  const reste = s.total_amount - s.amount_paid;
                  return (
                    <tr key={s.id}>
                      <td className="py-2 pr-4 font-medium text-gray-800">{s.invoice_number}</td>
                      <td className="py-2 pr-4 text-gray-600">{s.clients?.name || "—"}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{fmt(s.total_amount)}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{fmt(s.amount_paid)}</td>
                      <td className="py-2 pr-4 text-right font-semibold text-amber-700">{fmt(reste)}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => openPay("sale", s.id, reste)}
                          className="text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-2 py-1"
                        >
                          Encaisser
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="stat-card overflow-x-auto">
          {purchases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune dette en cours.</p>
          ) : (
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Facture</th>
                  <th className="pb-2 pr-4 font-medium">Fournisseur</th>
                  <th className="pb-2 pr-4 font-medium">Intrant</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium text-right">Payé</th>
                  <th className="pb-2 pr-4 font-medium text-right">Reste dû</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {purchases.map((p) => {
                  const reste = p.total_amount - p.amount_paid;
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-4 font-medium text-gray-800">{p.invoice_number || "—"}</td>
                      <td className="py-2 pr-4 text-gray-600">{p.suppliers?.name || "—"}</td>
                      <td className="py-2 pr-4 text-gray-600">{p.inputs?.name || "—"}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{fmt(p.total_amount)}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{fmt(p.amount_paid)}</td>
                      <td className="py-2 pr-4 text-right font-semibold text-amber-700">{fmt(reste)}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => openPay("purchase", p.id, reste)}
                          className="text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-2 py-1"
                        >
                          Payer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
