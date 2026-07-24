import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyFormatter } from "../context/SettingsContext";
import { Plus, Trash2, Pencil, Egg, X, AlertTriangle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
}

const productTypes = ["Plaquette d'œufs", "Poussins / Poulettes", "Fientes / Fumier", "Autre"];

const eggCalibres = ["Petit calibre", "Moyen calibre", "Gros calibre", "Extra calibre", "Cassés"];
const poultrySubtypes = ["Poussins d'un jour", "Poulettes", "Poules réformées"];

const defaultProducts = [
  { name: "Plaquette d'œufs petit calibre", category: "Plaquette d'œufs", unit: "Plaquette (30 œufs)", sale_price: 2000 },
  { name: "Plaquette d'œufs moyen calibre", category: "Plaquette d'œufs", unit: "Plaquette (30 œufs)", sale_price: 2200 },
  { name: "Plaquette d'œufs gros calibre", category: "Plaquette d'œufs", unit: "Plaquette (30 œufs)", sale_price: 2500 },
  { name: "Plaquette d'œufs extra calibre", category: "Plaquette d'œufs", unit: "Plaquette (30 œufs)", sale_price: 2800 },
  { name: "Œufs cassés", category: "Plaquette d'œufs", unit: "Unité", sale_price: 500 },
  { name: "Poules réformées", category: "Poussins / Poulettes", unit: "Tête", sale_price: 3000 },
  { name: "Fientes / Fumier", category: "Fientes / Fumier", unit: "Sac", sale_price: 10000 },
];

export default function ProductsPage() {
  const fmt = useCurrencyFormatter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [productType, setProductType] = useState(productTypes[0]);
  const [eggCalibre, setEggCalibre] = useState(eggCalibres[0]);
  const [poultrySubtype, setPoultrySubtype] = useState(poultrySubtypes[0]);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [showCost, setShowCost] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");
    if (!error && data) setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setProductType(productTypes[0]);
    setEggCalibre(eggCalibres[0]);
    setPoultrySubtype(poultrySubtypes[0]);
    setCustomName("");
    setCustomUnit("");
    setCostPrice("");
    setShowCost(false);
    setSalePrice("");
    setEditingId(null);
    setErrors({});
    setShowForm(false);
  };

  const computeNameAndUnit = (): { name: string; unit: string } | null => {
    if (productType === "Plaquette d'œufs") {
      return {
        name:
          eggCalibre === "Cassés"
            ? "Œufs cassés"
            : `Plaquette d'œufs ${eggCalibre.toLowerCase()}`,
        unit: eggCalibre === "Cassés" ? "Unité" : "Plaquette (30 œufs)",
      };
    }
    if (productType === "Poussins / Poulettes") {
      return { name: poultrySubtype, unit: "Tête" };
    }
    if (productType === "Fientes / Fumier") {
      return { name: "Fientes / Fumier", unit: "Sac" };
    }
    if (productType === "Autre") {
      if (!customName.trim()) return null;
      return { name: customName.trim(), unit: customUnit.trim() || "Unité" };
    }
    return null;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (productType === "Autre" && !customName.trim()) {
      newErrors.customName = "Ce champ est obligatoire.";
    }
    if (productType === "Autre" && !customUnit.trim()) {
      newErrors.customUnit = "Ce champ est obligatoire.";
    }
    if (!salePrice) {
      newErrors.salePrice = "Ce champ est obligatoire.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const computed = computeNameAndUnit();
    if (!computed) return;

    const payload = {
      name: computed.name,
      category: productType,
      unit: computed.unit,
      cost_price: Number(costPrice) || 0,
      sale_price: Number(salePrice),
    };

    if (editingId) {
      await supabase.from("products").update(payload).eq("id", editingId);
    } else {
      await supabase.from("products").insert({ ...payload, quantity: 0 });
    }
    resetForm();
    load();
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setCostPrice(String(p.cost_price));
    setShowCost(p.cost_price > 0);
    setSalePrice(String(p.sale_price));
    setErrors({});

    if (p.category === "Plaquette d'œufs") {
      setProductType("Plaquette d'œufs");
      const found = eggCalibres.find((c) =>
        c === "Cassés"
          ? p.name === "Œufs cassés"
          : p.name === `Plaquette d'œufs ${c.toLowerCase()}`
      );
      setEggCalibre(found || eggCalibres[0]);
    } else if (p.category === "Poussins / Poulettes") {
      setProductType("Poussins / Poulettes");
      setPoultrySubtype(poultrySubtypes.includes(p.name) ? p.name : poultrySubtypes[0]);
    } else if (p.category === "Fientes / Fumier") {
      setProductType("Fientes / Fumier");
    } else {
      setProductType("Autre");
      setCustomName(p.name);
      setCustomUnit(p.unit);
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    setConfirmDeleteId(null);
    load();
  };

  const seedDefaults = async () => {
    await supabase.from("products").insert(
      defaultProducts.map((p) => ({ ...p, cost_price: 0, quantity: 0 }))
    );
    load();
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const outOfStockCount = products.filter((p) => p.quantity === 0).length;

  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  const preview = computeNameAndUnit();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Produits</h1>
          <p className="text-sm text-gray-500">Gère ton catalogue d'œufs et sous-produits.</p>
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
            <button
              onClick={seedDefaults}
              className="text-sm text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-3 py-2 font-medium transition-colors"
            >
              Créer les produits standards
            </button>
          )}
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nouveau produit
          </button>
        </div>
      </div>

      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card !p-3">
            <p className="text-xs text-gray-400 uppercase">Nombre de produits</p>
            <p className="text-xl font-bold text-gray-800">{products.length}</p>
          </div>
          <div className="stat-card !p-3">
            <p className="text-xs text-gray-400 uppercase">Nombre produit en rupture</p>
            <p className={`text-xl font-bold ${outOfStockCount > 0 ? "text-red-600" : "text-gray-800"}`}>
              {outOfStockCount}
            </p>
          </div>
          <div className="stat-card !p-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 uppercase">Nombre de catégorie</p>
            <p className="text-xl font-bold text-gray-800">{Object.keys(grouped).length}</p>
          </div>
        </div>
      )}

      <input
        placeholder="Rechercher un produit..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {showForm && (
        <div className="stat-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">
              {editingId ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Type de produit</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {productType === "Plaquette d'œufs" && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Calibre</label>
              <select
                value={eggCalibre}
                onChange={(e) => setEggCalibre(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {eggCalibres.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {productType === "Poussins / Poulettes" && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Sous-type</label>
              <select
                value={poultrySubtype}
                onChange={(e) => setPoultrySubtype(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {poultrySubtypes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {productType === "Autre" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  placeholder="Nom du produit"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    errors.customName ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {errors.customName && (
                  <p className="text-xs text-red-600 mt-1">{errors.customName}</p>
                )}
              </div>
              <div>
                <input
                  placeholder="Unité (ex: Kg, Sac, Carton)"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    errors.customUnit ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {errors.customUnit && (
                  <p className="text-xs text-red-600 mt-1">{errors.customUnit}</p>
                )}
              </div>
            </div>
          )}

          {preview && (
            <p className="text-xs text-gray-400">
              Ce produit sera enregistré comme :{" "}
              <span className="font-medium text-gray-600">{preview.name}</span> — conditionnement :{" "}
              <span className="font-medium text-gray-600">{preview.unit}</span>
            </p>
          )}

          <div>
            <input
              type="number"
              placeholder="Prix de vente"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                errors.salePrice ? "border-red-400" : "border-gray-200"
              }`}
            />
            {errors.salePrice && <p className="text-xs text-red-600 mt-1">{errors.salePrice}</p>}
          </div>

          {!showCost ? (
            <button
              type="button"
              onClick={() => setShowCost(true)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              + Ajouter un coût de revient (si ce produit est acheté, pas produit sur place)
            </button>
          ) : (
            <input
              type="number"
              placeholder="Coût de revient (optionnel)"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          )}

          <button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {editingId ? "Enregistrer les modifications" : "Ajouter le produit"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="stat-card text-center py-8">
          <Egg size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">
            {products.length === 0 ? "Aucun produit pour l'instant." : "Aucun produit trouvé."}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="stat-card overflow-x-auto">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">{cat}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium">Conditionnement</th>
                  <th className="pb-2 font-medium text-right">Coût de revient</th>
                  <th className="pb-2 font-medium text-right">Prix de vente</th>
                  <th className="pb-2 font-medium text-right">Stock</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        {p.quantity === 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} />
                            Rupture
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-gray-500">{p.unit}</td>
                    <td className="py-3 text-right text-gray-400">
                      {p.cost_price > 0 ? fmt(p.cost_price) : "—"}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-800">{fmt(p.sale_price)}</td>
                    <td className="py-3 text-right text-gray-600">{p.quantity}</td>
                    <td className="py-3">
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
                              onClick={() => handleEdit(p)}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Pencil size={15} />
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
          </div>
        ))
      )}
    </div>
  );
}
