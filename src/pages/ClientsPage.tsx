import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, Pencil, Users, X } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string | null;
}

export default function ClientsPage() {
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setClients(data as Client[]);
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
        .from("clients")
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq("id", editingId);
    } else {
      await supabase
        .from("clients")
        .insert({ name: name.trim(), phone: phone.trim() || null, owner_id: user?.id });
    }
    resetForm();
    load();
  };

  const handleEdit = (c: Client) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone ?? "");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    setConfirmDeleteId(null);
    load();
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Clients</h1>
          <p className="text-sm text-gray-500">
            {clients.length} client{clients.length > 1 ? "s" : ""} enregistré{clients.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            document.getElementById("client-form")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <input
        placeholder="Rechercher un client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <div id="client-form" className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">
            {editingId ? "Modifier le client" : "Nouveau client"}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Nom du client"
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
          {editingId ? "Enregistrer les modifications" : "Ajouter le client"}
        </button>
      </div>

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8">
            <Users size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              {clients.length === 0 ? "Aucun client pour l'instant." : "Aucun client trouvé."}
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
              {filteredClients.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="py-3 text-gray-500">{c.phone || "—"}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === c.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(c.id)}
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
                            onClick={() => handleEdit(c)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(c.id)}
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
