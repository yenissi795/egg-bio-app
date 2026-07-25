import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Plus, ShoppingCart, X, FileDown } from "lucide-react";
import { useSettings, useCurrencyFormatter } from "../context/SettingsContext";
import { buildInvoiceDoc } from "../lib/invoicePdf";
import logoImg from "../assets/logo.jpg";

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
  quantity: number;
}

interface SaleLine {
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface Sale {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  created_at: string;
  clients: { name: string } | null;
}

interface SaleItemRow {
  sale_id: string;
  quantity: number;
  unit_price: number;
  products: { name: string; unit: string } | null;
}

const num = (s: string) => (s === "" ? 0 : Number(s)) || 0;

export default function SalesPage() {
  const { user } = useAuth();
  const { companyName, subtitle, phone, address, currency } = useSettings();
  const fmt = useCurrencyFormatter();

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItemsBySale, setSaleItemsBySale] = useState<Record<string, SaleItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [amountPaid, setAmountPaid] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: clientsData }, { data: productsData }, { data: salesData }, { data: itemsData }] =
      await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("products").select("id, name, unit, sale_price, quantity").order("name"),
        supabase
          .from("sales")
          .select("id, invoice_number, total_amount, amount_paid, payment_status, created_at, clients(name)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("sale_items").select("sale_id, quantity, unit_price, products(name, unit)"),
      ]);
    setClients((clientsData as Client[]) || []);
    setProducts((productsData as Product[]) || []);
    setSales((salesData as unknown as Sale[]) || []);

    const grouped: Record<string, SaleItemRow[]> = {};
    ((itemsData as unknown as SaleItemRow[]) || []).forEach((row) => {
      if (!grouped[row.sale_id]) grouped[row.sale_id] = [];
      grouped[row.sale_id].push(row);
    });
    setSaleItemsBySale(grouped);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addLine = () => {
    if (products.length === 0) return;
    const first = products[0];
    setLines([...lines, { productId: first.id, quantity: "1", unitPrice: String(first.sale_price) }]);
  };

  const updateLine = (index: number, patch: Partial<SaleLine>) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      productId,
      unitPrice: product ? String(product.sale_price) : "0",
    });
  };

  const total = lines.reduce((sum, l) => sum + num(l.quantity) * num(l.unitPrice), 0);
  const paid = num(amountPaid);

  const resetForm = () => {
    setClientId("");
    setClientMode("existing");
    setNewClientName("");
    setNewClientPhone("");
    setLines([]);
    setAmountPaid("");
  };

  const handleSave = async () => {
    if (clientMode === "existing" && !clientId) {
      alert("Choisis un client.");
      return;
    }
    if (clientMode === "new" && !newClientName.trim()) {
      alert("Renseigne le nom du nouveau client.");
      return;
    }
    if (lines.length === 0) {
      alert("Ajoute au moins un produit.");
      return;
    }
    for (const l of lines) {
      const product = products.find((p) => p.id === l.productId);
      const enteredQty = num(l.quantity);
      if (product && enteredQty > product.quantity) {
        alert(`Stock insuffisant pour "${product.name}" (disponible : ${product.quantity} ${product.unit}).`);
        return;
      }
    }

    setSaving(true);

    let finalClientId = clientId;
    if (clientMode === "new") {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ name: newClientName.trim(), phone: newClientPhone.trim() || null, owner_id: user?.id })
        .select()
        .single();
      if (clientError || !newClient) {
        alert("Erreur lors de la création du client.");
        setSaving(false);
        return;
      }
      finalClientId = newClient.id;
    }

    const invoiceNumber = `VNT-${String(sales.length + 1).padStart(5, "0")}`;
    const status = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        client_id: finalClientId,
        invoice_number: invoiceNumber,
        total_amount: total,
        amount_paid: paid,
        payment_status: status,
        owner_id: user?.id,
      })
      .select()
      .single();

    if (saleError || !sale) {
      alert("Erreur lors de l'enregistrement de la vente.");
      setSaving(false);
      return;
    }

    const items = lines.map((l) => ({
      sale_id: sale.id,
      product_id: l.productId,
      quantity: num(l.quantity),
      unit_price: num(l.unitPrice),
      owner_id: user?.id,
    }));
    await supabase.from("sale_items").insert(items);

    for (const l of lines) {
      const product = products.find((p) => p.id === l.productId);
      if (product) {
        await supabase
          .from("products")
          .update({ quantity: product.quantity - num(l.quantity) })
          .eq("id", l.productId);
      }
    }

    setSaving(false);
    resetForm();
    load();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "bg-green-100 text-green-700",
      partial: "bg-amber-100 text-amber-700",
      unpaid: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      paid: "Payé",
      partial: "Partiel",
      unpaid: "Non payé",
    };
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${map[status] || "bg-gray-100 text-gray-600"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const summaryFor = (saleId: string) => {
    const items = saleItemsBySale[saleId];
    if (!items || items.length === 0) return "—";
    return items.map((it) => `${it.quantity}× ${it.products?.name || "Produit"}`).join(", ");
  };

  const handleInvoice = async (sale: Sale) => {
    const rows = saleItemsBySale[sale.id] || [];
    const items = rows.map((r) => ({
      label: r.products?.name || "Produit",
      quantity: r.quantity,
      unit: r.products?.unit || "",
      unitPrice: r.unit_price,
      total: r.quantity * r.unit_price,
    }));

    const statusLabels: Record<string, string> = { paid: "Payé", partial: "Partiel", unpaid: "Non payé" };

    const doc = await buildInvoiceDoc({
      type: "vente",
      invoiceNumber: sale.invoice_number,
      date: sale.created_at,
      partyLabel: "Client",
      partyName: sale.clients?.name || "—",
      items,
      total: sale.total_amount,
      paid: sale.amount_paid,
      extraLine: { label: "Statut", value: statusLabels[sale.payment_status] || sale.payment_status },
      remainingDue: Math.max(0, sale.total_amount - sale.amount_paid),
      company: { name: companyName, subtitle, phone, address, logoUrl: logoImg },
      currency,
    });
    doc.save(`Facture_${sale.invoice_number}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Ventes</h1>
        <p className="text-sm text-gray-500">Enregistre une nouvelle vente et suis ton historique.</p>
      </div>

      <div className="stat-card space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm">Nouvelle vente</h2>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Client *</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setClientMode("existing")}
              className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                clientMode === "existing" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
              }`}
            >
              Client existant
            </button>
            <button
              type="button"
              onClick={() => setClientMode("new")}
              className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                clientMode === "new" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
              }`}
            >
              + Nouveau client
            </button>
          </div>

          {clientMode === "existing" ? (
            <>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Sélectionner un client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Aucun client enregistré — bascule sur "+ Nouveau client".</p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Nom du client"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Téléphone (optionnel)"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">Produits *</label>
            <button
              onClick={addLine}
              disabled={products.length === 0}
              className="flex items-center gap-1 text-xs text-green-700 font-medium disabled:opacity-40"
            >
              <Plus size={14} />
              Ajouter un produit
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Aucun produit ajouté.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((line, index) => {
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <select
                        value={line.productId}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-2 text-sm"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (stock: {p.quantity} {p.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                      />
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                      />
                      <span className="text-sm text-gray-500 w-24 text-right">
                        {fmt(num(line.quantity) * num(line.unitPrice))}
                      </span>
                      <button
                        onClick={() => removeLine(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-lg font-bold text-gray-800">{fmt(total)}</span>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Montant payé</label>
          <input
            type="number"
            placeholder="0"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="w-full sm:w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {total > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Reste : {fmt(Math.max(0, total - paid))}
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer la vente"}
        </button>
      </div>

      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des ventes</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Aucune vente pour l'instant.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Facture</th>
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 pr-4 font-medium">Produits vendus</th>
                <th className="pb-2 pr-4 font-medium">Date / Heure</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 pr-4 font-medium text-right">Statut</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4 font-medium text-gray-800 align-top">{s.invoice_number}</td>
                  <td className="py-2 pr-4 text-gray-600 align-top">{s.clients?.name || "—"}</td>
                  <td className="py-2 pr-4 text-gray-600 align-top max-w-[220px]">{summaryFor(s.id)}</td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap align-top">
                    {new Date(s.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-800 align-top">
                    {fmt(s.total_amount)}
                  </td>
                  <td className="py-2 pr-4 text-right align-top">{statusBadge(s.payment_status)}</td>
                  <td className="py-2 text-right align-top">
                    <button
                      onClick={() => handleInvoice(s)}
                      className="flex items-center gap-1 text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-2 py-1"
                    >
                      <FileDown size={13} />
                      Facture
                    </button>
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
