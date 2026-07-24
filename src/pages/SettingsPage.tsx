import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { AlertTriangle } from "lucide-react";

const currencyOptions = ["FCFA", "USD", "EUR", "GBP", "XOF", "MAD"];

export default function SettingsPage() {
  const { companyName, subtitle, phone, address, currency, loading, save } = useSettings();
  const { user } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const [name, setName] = useState("");
  const [sub, setSub] = useState("");
  const [ph, setPh] = useState("");
  const [addr, setAddr] = useState("");
  const [curr, setCurr] = useState("FCFA");
  const [customCurrency, setCustomCurrency] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading) {
      setName(companyName);
      setSub(subtitle);
      setPh(phone);
      setAddr(address);
      if (currencyOptions.includes(currency)) {
        setCurr(currency);
        setIsCustom(false);
      } else {
        setIsCustom(true);
        setCustomCurrency(currency);
      }
    }
  }, [loading, companyName, subtitle, phone, address, currency]);

  const handleSaveCompany = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Ce champ est obligatoire.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    await save({
      companyName: name.trim(),
      subtitle: sub.trim(),
      phone: ph.trim(),
      address: addr.trim(),
      currency: isCustom ? customCurrency.trim() || "FCFA" : curr,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCurrencyChange = async (value: string) => {
    setIsCustom(false);
    setCurr(value);
    await save({
      companyName: name.trim() || companyName,
      subtitle: sub.trim(),
      phone: ph.trim(),
      address: addr.trim(),
      currency: value,
    });
  };

  const handleCustomCurrencySave = async () => {
    if (!customCurrency.trim()) return;
    await save({
      companyName: name.trim() || companyName,
      subtitle: sub.trim(),
      phone: ph.trim(),
      address: addr.trim(),
      currency: customCurrency.trim(),
    });
  };

  const tablesToReset = [
    "sale_items",
    "sales",
    "purchases",
    "inputs",
    "expenses",
    "cash_transactions",
    "reforms",
    "manure_productions",
    "egg_production",
    "flock_mortality",
    "flocks",
    "products",
    "clients",
    "suppliers",
  ];

  const handleReset = async () => {
    if (!user) return;
    setResetting(true);
    for (const table of tablesToReset) {
      await supabase.from(table).delete().eq("owner_id", user.id);
    }
    setResetting(false);
    setConfirmReset(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 4000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Paramètres</h1>
      </div>

      <div className="stat-card space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">Informations de l'entreprise</h2>
        <p className="text-xs text-gray-500">
          Ces informations apparaissent sur les factures et les rapports PDF. Vous pouvez les modifier à
          tout moment.
        </p>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Nom de l'entreprise</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm ${
              errors.name ? "border-red-400" : "border-gray-200"
            }`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Sous-titre / Activité</label>
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            placeholder="Ex: Production et vente d'œufs bio"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone / WhatsApp</label>
          <input
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={handleSaveCompany}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>

      <div className="stat-card space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">Devise de l'application</h2>
        <p className="text-xs text-gray-500">
          La devise choisie est appliquée à toute l'application. Les valeurs déjà enregistrées ne sont
          pas modifiées.
        </p>
        <p className="text-sm text-gray-600">
          Devise actuelle : <span className="font-semibold">{isCustom ? customCurrency : curr}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {currencyOptions.map((c) => (
            <button
              key={c}
              onClick={() => handleCurrencyChange(c)}
              className={`text-xs font-medium rounded-lg px-3 py-2 ${
                !isCustom && curr === c ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setIsCustom(true)}
            className={`text-xs font-medium rounded-lg px-3 py-2 ${
              isCustom ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
            }`}
          >
            Devise personnalisée
          </button>
        </div>

        {isCustom && (
          <div className="flex gap-2">
            <input
              value={customCurrency}
              onChange={(e) => setCustomCurrency(e.target.value)}
              placeholder="Ex: GNF, CFA, ..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleCustomCurrencySave}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Valider
            </button>
          </div>
        )}
      </div>

      <div className="stat-card space-y-3 border border-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="font-semibold text-red-700 text-sm">Zone dangereuse</h2>
        </div>
        <p className="text-xs text-gray-500">
          Réinitialise toutes tes données métier (produits, clients, fournisseurs, ventes,
          production, achats, dépenses, caisse). Tes paramètres (nom, devise) ne sont pas
          affectés. Cette action est irréversible.
        </p>

        {resetDone && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Toutes les données ont été réinitialisées.
          </p>
        )}

        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-700">
              Es-tu sûr(e) ? Toutes tes données seront définitivement supprimées.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {resetting ? "Réinitialisation..." : "Oui, tout réinitialiser"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-sm text-gray-500 hover:bg-gray-100 rounded-lg px-4 py-2"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-4 py-2"
          >
            Réinitialiser toutes les données
          </button>
        )}
      </div>
    </div>
  );
}
