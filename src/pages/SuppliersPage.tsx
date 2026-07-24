import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, Pencil, Factory, X } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

export default function SuppliersPage() {
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSuppliers(data as Supplier[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await supabase
        .from("suppliers")
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq("id", editingId);
    } else {
      await supabase
        .from("suppliers")
        .insert({ name: name.trim(), phone: phone.trim() || null, owner_id: user?.id });
    }
    resetForm();
    load();
  };

  const handleEdit = (s: Supplier) => {
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone ?? "");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("suppliers").delete().eq("id", id);
    setConfirmDeleteId(null);
    load();
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Fournisseurs</h1>
          <p className="text-sm text-gray-500">
            {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} enregistré{suppliers.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            document.getElementById("supplier-form")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <input
        placeholder="Rechercher un fournisseur..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div id="supplier-form" className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">
            {editingId ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Nom (ex: Fournisseur aliment)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            placeholder="Téléphone (optionnel)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {editingId ? "Enregistrer les modifications" : "Ajouter le fournisseur"}
        </button>
      </div>

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-8">
            <Factory size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              {suppliers.length === 0 ? "Aucun fournisseur pour l'instant." : "Aucun fournisseur trouvé."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">Téléphone</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSuppliers.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="py-3 text-gray-500">{s.phone || "—"}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === s.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(s.id)}
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
                            onClick={() => handleEdit(s)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(s.id)}
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
