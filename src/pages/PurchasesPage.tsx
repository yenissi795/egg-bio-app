import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { Plus, Package, X, Trash2, FileDown } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { buildInvoiceDoc } from "../lib/invoicePdf";
import logoImg from "../assets/logo.png";

interface Supplier {
  id: string;
  name: string;
}

interface InputItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
}

interface Purchase {
  id: string;
  input_id: string;
  supplier_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  payment_source: string;
  invoice_number: string | null;
  notes: string | null;
  purchase_date: string;
  created_at: string;
  inputs?: { name: string; unit: string };
  suppliers?: { name: string };
}

const defaultCategories = ["Aliments pour bétail", "Santé animale", "Emballages", "Souches"];

const inputSuggestions: Record<string, string[]> = {
  "Aliments pour bétail": [
    "Maïs",
    "Tourteau de soja",
    "Son de blé",
    "Calcaire",
    "CMV",
    "Aliment complet pondeuses",
    "Aliment croissance",
    "Aliment démarrage",
  ],
  "Santé animale": ["Vaccins", "Médicaments", "Vitamines", "Antiparasitaires", "Désinfectants", "Produits vétérinaires"],
  Emballages: ["Plateaux alvéolés", "Cartons", "Étiquettes", "Films plastiques", "Sacs"],
  Souches: ["Poussins d'un jour", "Poulettes", "Souche ISA Brown", "Souche Lohmann Brown", "Souche Hy-Line Brown"],
};

const unitOptions = ["Kg", "Sac", "Litre", "Unité", "Carton", "Tête"];

const paymentSourceLabels: Record<string, string> = {
  cash: "Caisse",
  personal: "Personnel",
  credit: "Crédit",
  advance: "Avance fournisseur",
};

export default function PurchasesPage() {
  const fmt = useCurrencyFormatter();
  const { user } = useAuth();
  const { companyName, subtitle, phone, address, currency } = useSettings();

  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [categoryMode, setCategoryMode] = useState<"existing" | "custom">("existing");
  const [category, setCategory] = useState(defaultCategories[0]);
  const [customCategory, setCustomCategory] = useState("");

  const [inputMode, setInputMode] = useState<"existing" | "new">("existing");
  const [existingInputId, setExistingInputId] = useState("");
  const [newInputName, setNewInputName] = useState("");
  const [newInputUnit, setNewInputUnit] = useState(unitOptions[0]);

  const [supplierMode, setSupplierMode] = useState<"existing" | "new">("existing");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("caisse");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: inputsData }, { data: suppliersData }, { data: purchasesData }] = await Promise.all([
      supabase.from("inputs").select("*").order("category").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase
        .from("purchases")
        .select("*, inputs(name, unit), suppliers(name)")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setInputs((inputsData as InputItem[]) || []);
    setSuppliers((suppliersData as Supplier[]) || []);
    setPurchases((purchasesData as unknown as Purchase[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setCategoryMode("existing");
    setCategory(defaultCategories[0]);
    setCustomCategory("");
    setInputMode("existing");
    setExistingInputId("");
    setNewInputName("");
    setNewInputUnit(unitOptions[0]);
    setSupplierMode("existing");
    setSupplierId("");
    setNewSupplierName("");
    setNewSupplierPhone("");
    setQuantity("");
    setUnitPrice("");
    setPaymentSource("cash");
    setAmountPaid("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSource("caisse");
    setErrors({});
    setShowForm(false);
  };

  const finalCategory = categoryMode === "custom" ? customCategory.trim() : category;
  const inputsForCategory = inputs.filter((i) => i.category === finalCategory);
  const totalAmount = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const nextInvoiceNumber = `ACH-${String(purchases.length + 1).padStart(5, "0")}`;

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (categoryMode === "custom" && !customCategory.trim()) {
      newErrors.customCategory = "Ce champ est obligatoire.";
    }
    if (inputMode === "existing" && !existingInputId) {
      newErrors.existingInputId = "Sélectionne un intrant.";
    }
    if (inputMode === "new" && !newInputName.trim()) {
      newErrors.newInputName = "Ce champ est obligatoire.";
    }
    if (supplierMode === "existing" && !supplierId) {
      newErrors.supplierId = "Sélectionne un fournisseur.";
    }
    if (supplierMode === "new" && !newSupplierName.trim()) {
      newErrors.newSupplierName = "Ce champ est obligatoire.";
    }
    if (!quantity) newErrors.quantity = "Ce champ est obligatoire.";
    if (!unitPrice) newErrors.unitPrice = "Ce champ est obligatoire.";
    if (!purchaseDate) newErrors.purchaseDate = "Ce champ est obligatoire.";
    if (!amountPaid) newErrors.amountPaid = "Ce champ est obligatoire.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    let finalSupplierId = supplierId;
    if (supplierMode === "new") {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("suppliers")
        .insert({ name: newSupplierName.trim(), phone: newSupplierPhone.trim() || null, owner_id: user?.id })
        .select()
        .single();
      if (supplierError || !newSupplier) {
        setSaving(false);
        return;
      }
      finalSupplierId = newSupplier.id;
    }

    let inputId = existingInputId;
    const qty = Number(quantity);

    if (inputMode === "new") {
      const { data: newInput, error: inputError } = await supabase
        .from("inputs")
        .insert({
          name: newInputName.trim(),
          category: finalCategory,
          unit: newInputUnit,
          quantity: qty,
          owner_id: user?.id,
        })
        .select()
        .single();

      if (inputError || !newInput) {
        setSaving(false);
        return;
      }
      inputId = newInput.id;
    } else {
      const existing = inputs.find((i) => i.id === existingInputId);
      if (existing) {
        await supabase
          .from("inputs")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existingInputId);
      }
    }

    await supabase.from("purchases").insert({
      input_id: inputId,
      supplier_id: finalSupplierId,
      quantity: qty,
      unit_price: Number(unitPrice),
      total_amount: totalAmount,
      amount_paid: Number(amountPaid),
      payment_source: paymentSource,
      source,
      invoice_number: nextInvoiceNumber,
      notes: notes.trim() || null,
      purchase_date: purchaseDate,
      owner_id: user?.id,
    });

    setSaving(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("purchases").delete().eq("id", id);
    setConfirmDeleteId(null);
    load();
  };

  const handleReceipt = async (p: Purchase) => {
    const doc = await buildInvoiceDoc({
      type: "achat",
      invoiceNumber: p.invoice_number || "—",
      date: p.created_at,
      partyLabel: "Fournisseur",
      partyName: p.suppliers?.name || "—",
      items: [
        {
          label: p.inputs?.name || "Intrant",
          quantity: p.quantity,
          unit: p.inputs?.unit || "",
          unitPrice: p.unit_price,
          total: p.total_amount,
        },
      ],
      total: p.total_amount,
      paid: p.amount_paid,
      extraLine: { label: "Mode", value: paymentSourceLabels[p.payment_source] || p.payment_source },
      company: { name: companyName, subtitle, phone, address, logoUrl: logoImg },
      currency,
    });
    doc.save(`Achat_${p.invoice_number || p.id}.pdf`);
  };

  const totalPurchasesAmount = purchases.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Achats</h1>
          <p className="text-sm text-gray-500">Approvisionnement en intrants auprès des fournisseurs.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouvel achat
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Nombre d'achats</p>
          <p className="text-xl font-bold text-gray-800">{purchases.length}</p>
        </div>
        <div className="stat-card !p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 uppercase">Montant total</p>
          <p className="text-xl font-bold text-gray-800">{fmt(totalPurchasesAmount)}</p>
        </div>
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Références d'intrants</p>
          <p className="text-xl font-bold text-gray-800">{inputs.length}</p>
        </div>
      </div>

      {showForm && (
        <div className="stat-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Nouvel achat</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Catégorie</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setCategoryMode("existing")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  categoryMode === "existing" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                Catégorie existante
              </button>
              <button
                type="button"
                onClick={() => setCategoryMode("custom")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  categoryMode === "custom" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                + Nouvelle catégorie
              </button>
            </div>
            {categoryMode === "existing" ? (
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setExistingInputId("");
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {defaultCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  placeholder="Nom de la nouvelle catégorie"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    errors.customCategory ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {errors.customCategory && (
                  <p className="text-xs text-red-600 mt-1">{errors.customCategory}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Intrant</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setInputMode("existing")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  inputMode === "existing" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                Intrant existant
              </button>
              <button
                type="button"
                onClick={() => setInputMode("new")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  inputMode === "new" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                + Nouvel intrant
              </button>
            </div>

            {inputMode === "existing" ? (
              <div>
                <select
                  value={existingInputId}
                  onChange={(e) => setExistingInputId(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    errors.existingInputId ? "border-red-400" : "border-gray-200"
                  }`}
                >
                  <option value="">Sélectionner un intrant</option>
                  {inputsForCategory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (stock: {i.quantity} {i.unit})
                    </option>
                  ))}
                </select>
                {errors.existingInputId && (
                  <p className="text-xs text-red-600 mt-1">{errors.existingInputId}</p>
                )}
                {inputsForCategory.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Aucun intrant dans cette catégorie — utilise "+ Nouvel intrant".
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <input
                    list="input-suggestions"
                    placeholder="Nom de l'intrant"
                    value={newInputName}
                    onChange={(e) => setNewInputName(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${
                      errors.newInputName ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  <datalist id="input-suggestions">
                    {(inputSuggestions[finalCategory] || []).map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  {errors.newInputName && (
                    <p className="text-xs text-red-600 mt-1">{errors.newInputName}</p>
                  )}
                </div>
                <select
                  value={newInputUnit}
                  onChange={(e) => setNewInputUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Fournisseur</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSupplierMode("existing")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  supplierMode === "existing" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                Fournisseur existant
              </button>
              <button
                type="button"
                onClick={() => setSupplierMode("new")}
                className={`flex-1 text-xs font-medium rounded-lg py-2 ${
                  supplierMode === "new" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                + Nouveau fournisseur
              </button>
            </div>

            {supplierMode === "existing" ? (
              <div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    errors.supplierId ? "border-red-400" : "border-gray-200"
                  }`}
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.supplierId && (
                  <p className="text-xs text-red-600 mt-1">{errors.supplierId}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input
                    placeholder="Nom du fournisseur"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${
                      errors.newSupplierName ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  {errors.newSupplierName && (
                    <p className="text-xs text-red-600 mt-1">{errors.newSupplierName}</p>
                  )}
                </div>
                <input
                  placeholder="Téléphone (optionnel)"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                placeholder="Quantité"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.quantity ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <input
                type="number"
                placeholder="Prix unitaire"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.unitPrice ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.unitPrice && <p className="text-xs text-red-600 mt-1">{errors.unitPrice}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-gray-500">Montant total</span>
            <span className="text-sm font-bold text-gray-800">{fmt(totalAmount)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Mode de paiement</label>
              <select
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(paymentSourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Montant payé</label>
              <input
                type="number"
                placeholder="Montant payé"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.amountPaid ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.amountPaid && (
                <p className="text-xs text-red-600 mt-1">{errors.amountPaid}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date d'achat</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  errors.purchaseDate ? "border-red-400" : "border-gray-200"
                }`}
              />
              {errors.purchaseDate && (
                <p className="text-xs text-red-600 mt-1">{errors.purchaseDate}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">N° de facture</label>
              <input
                value={nextInvoiceNumber}
                disabled
                className="w-full border border-gray-200 bg-gray-50 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <input
            placeholder="Observations (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Source de financement
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="caisse">Caisse (n'affecte pas le bénéfice)</option>
              <option value="benefice">Bénéfice (déduit comme charge)</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer l'achat"}
          </button>
        </div>
      )}

      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des achats</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Aucun achat pour l'instant.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Facture</th>
                <th className="pb-2 pr-4 font-medium">Intrant</th>
                <th className="pb-2 pr-4 font-medium">Fournisseur</th>
                <th className="pb-2 pr-4 font-medium text-right">Quantité</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 pr-4 font-medium">Paiement</th>
                <th className="pb-2 pr-4 font-medium">Date / Heure</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-gray-500">{p.invoice_number || "—"}</td>
                  <td className="py-2 pr-4 font-medium text-gray-800">
                    {p.inputs?.name || "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{p.suppliers?.name || "—"}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">
                    {p.quantity} {p.inputs?.unit}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-800">
                    {fmt(p.total_amount)}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{paymentSourceLabels[p.payment_source]}</td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === p.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(p.id)}
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
                        <>
                          <button
                            onClick={() => handleReceipt(p)}
                            className="flex items-center gap-1 text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-2 py-1 mr-1"
                          >
                            <FileDown size={13} />
                            Reçu
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
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
