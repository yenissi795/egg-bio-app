import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Plus, Egg, AlertTriangle, TrendingUp, Skull, X } from "lucide-react";

// --- Types existants ---
interface Flock {
  id: string;
  name: string;
  initial_count: number;
  initial_age_weeks: number;
  start_date: string;
  breed: string | null;
  status: string;
}

interface Mortality {
  id: string;
  flock_id: string;
  count: number;
  mortality_date: string;
}

interface ProductionEntry {
  id: string;
  flock_id: string;
  production_date: string;
  petit: number;
  moyen: number;
  gros: number;
  extra: number;
  casses: number;
  created_at: string;
}

// --- Types Réforme / Fumier ---
interface Reform {
  id: string;
  lot_id: string;
  nb_heads: number;
  observations?: string;
  created_at: string;
  lot?: { name: string };
}

interface ManureProduction {
  id: string;
  lot_id: string;
  quantity_kg: number;
  observations?: string;
  created_at: string;
  lot?: { name: string };
}

// --- Constantes ---
const breedOptions = ["ISA Brown", "Lohmann Brown", "Hy-Line Brown", "Autre"];
const REFORM_AGE_WEEKS = 70;

const ageInWeeks = (flock: Flock) => {
  const diffMs = Date.now() - new Date(flock.start_date).getTime();
  const weeksSincePurchase = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  return flock.initial_age_weeks + weeksSincePurchase;
};

export default function ProductionPage() {
  const { user } = useAuth();

  // --- États existants ---
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [mortalities, setMortalities] = useState<Mortality[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour les lots
  const [showFlockForm, setShowFlockForm] = useState(false);
  const [flockName, setFlockName] = useState("");
  const [flockCount, setFlockCount] = useState("");
  const [flockAgeWeeks, setFlockAgeWeeks] = useState("");
  const [flockBreed, setFlockBreed] = useState(breedOptions[0]);
  const [flockBreedCustom, setFlockBreedCustom] = useState("");
  const [flockDate, setFlockDate] = useState(new Date().toISOString().slice(0, 10));
  const [flockErrors, setFlockErrors] = useState<Record<string, string>>({});

  // États pour la mortalité
  const [mortalityFlock, setMortalityFlock] = useState<string | null>(null);
  const [mortalityCount, setMortalityCount] = useState("");
  const [mortalityError, setMortalityError] = useState("");

  // États pour la ponte
  const [selectedFlock, setSelectedFlock] = useState("");
  const [prodDate, setProdDate] = useState(new Date().toISOString().slice(0, 10));
  const [petit, setPetit] = useState("");
  const [moyen, setMoyen] = useState("");
  const [gros, setGros] = useState("");
  const [extra, setExtra] = useState("");
  const [casses, setCasses] = useState("");
  const [prodErrors, setProdErrors] = useState<Record<string, string>>({});
  const [stockWarning, setStockWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // --- États pour la réforme ---
  const [reformFlockId, setReformFlockId] = useState("");
  const [reformNbHeads, setReformNbHeads] = useState("");
  const [reformObservations, setReformObservations] = useState("");
  const [reformErrors, setReformErrors] = useState<Record<string, string>>({});
  const [reformSaving, setReformSaving] = useState(false);
  const [reforms, setReforms] = useState<Reform[]>([]);

  // --- États pour le fumier ---
  const [manureFlockId, setManureFlockId] = useState("");
  const [manureQuantity, setManureQuantity] = useState("");
  const [manureObservations, setManureObservations] = useState("");
  const [manureErrors, setManureErrors] = useState<Record<string, string>>({});
  const [manureSaving, setManureSaving] = useState(false);
  const [manureProductions, setManureProductions] = useState<ManureProduction[]>([]);

  // --- Fonction générique de mise à jour du stock ---
  const updateProductStock = async (
    productName: string,
    category: string,
    unit: string,
    quantity: number
  ): Promise<{ ok: boolean; name: string; error?: string }> => {
    if (quantity <= 0) return { ok: true, name: productName };

    const { data: existingList, error: findError } = await supabase
      .from("products")
      .select("id, quantity")
      .eq("name", productName)
      .order("created_at", { ascending: true })
      .limit(1);

    if (findError) {
      return { ok: false, name: productName, error: findError.message };
    }

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;

    if (existing) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ quantity: existing.quantity + quantity })
        .eq("id", existing.id);

      if (updateError) {
        return { ok: false, name: productName, error: updateError.message };
      }
      return { ok: true, name: productName };
    }

    const { error: insertError } = await supabase.from("products").insert({
      name: productName,
      category: category,
      unit: unit,
      cost_price: 0,
      sale_price: 0,
      quantity: quantity,
      owner_id: user?.id,
    });

    if (insertError) {
      return { ok: false, name: productName, error: insertError.message };
    }

    return { ok: true, name: productName };
  };

  // --- Chargement des données ---
  const load = async () => {
    setLoading(true);
    const [
      { data: flocksData },
      { data: mortData },
      { data: prodData },
      { data: reformsData },
      { data: manureData },
    ] = await Promise.all([
      supabase.from("flocks").select("*").order("start_date", { ascending: false }),
      supabase.from("flock_mortality").select("*"),
      supabase
        .from("egg_production")
        .select("*")
        .order("production_date", { ascending: false })
        .limit(30),
      supabase
        .from("reforms")
        .select("*, lot:lot_id(name)")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("manure_productions")
        .select("*, lot:lot_id(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setFlocks((flocksData as Flock[]) || []);
    setMortalities((mortData as Mortality[]) || []);
    setEntries((prodData as ProductionEntry[]) || []);
    setReforms((reformsData as unknown as Reform[]) || []);
    setManureProductions((manureData as unknown as ManureProduction[]) || []);

    if (flocksData && flocksData.length > 0) {
      setSelectedFlock((prev) => prev || flocksData[0].id);
      setReformFlockId((prev) => prev || flocksData[0].id);
      setManureFlockId((prev) => prev || flocksData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Effectif réel du lot : initial_count - mortalité - réformes ---
  const currentCount = (flockId: string) => {
    const flock = flocks.find((f) => f.id === flockId);
    if (!flock) return 0;
    const lost = mortalities
      .filter((m) => m.flock_id === flockId)
      .reduce((sum, m) => sum + m.count, 0);
    const reformed = reforms
      .filter((r) => r.lot_id === flockId)
      .reduce((sum, r) => sum + r.nb_heads, 0);
    return Math.max(0, flock.initial_count - lost - reformed);
  };

  const handleCreateFlock = async () => {
    const errors: Record<string, string> = {};
    if (!flockName.trim()) errors.flockName = "Ce champ est obligatoire.";
    if (!flockCount) errors.flockCount = "Ce champ est obligatoire.";
    if (flockBreed === "Autre" && !flockBreedCustom.trim())
      errors.flockBreedCustom = "Précise la race.";
    if (!flockAgeWeeks) errors.flockAgeWeeks = "Ce champ est obligatoire.";
    if (!flockDate) errors.flockDate = "Ce champ est obligatoire.";

    setFlockErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const breed = flockBreed === "Autre" ? flockBreedCustom.trim() : flockBreed;
    await supabase.from("flocks").insert({
      name: flockName.trim(),
      initial_count: Number(flockCount),
      initial_age_weeks: Number(flockAgeWeeks) || 0,
      breed: breed || null,
      start_date: flockDate,
      owner_id: user?.id,
    });
    setFlockName("");
    setFlockCount("");
    setFlockAgeWeeks("");
    setFlockBreed(breedOptions[0]);
    setFlockBreedCustom("");
    setFlockErrors({});
    setShowFlockForm(false);
    load();
  };

  const handleAddMortality = async (flockId: string) => {
    if (!mortalityCount) {
      setMortalityError("Ce champ est obligatoire.");
      return;
    }
    const count = Number(mortalityCount);
    if (!count || count <= 0) {
      setMortalityError("Renseigne un nombre supérieur à 0.");
      return;
    }
    await supabase.from("flock_mortality").insert({
      flock_id: flockId,
      count,
      mortality_date: new Date().toISOString().slice(0, 10),
      owner_id: user?.id,
    });
    setMortalityFlock(null);
    setMortalityCount("");
    setMortalityError("");
    load();
  };

  const handleSaveProduction = async () => {
    const errors: Record<string, string> = {};
    if (!selectedFlock) errors.selectedFlock = "Sélectionne un lot.";
    if (!prodDate) errors.prodDate = "Ce champ est obligatoire.";
    if (petit === "") errors.petit = "Ce champ est obligatoire.";
    if (moyen === "") errors.moyen = "Ce champ est obligatoire.";
    if (gros === "") errors.gros = "Ce champ est obligatoire.";
    if (extra === "") errors.extra = "Ce champ est obligatoire.";
    if (casses === "") errors.casses = "Ce champ est obligatoire.";

    setProdErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const p = Number(petit);
    const m = Number(moyen);
    const g = Number(gros);
    const e = Number(extra);
    const c = Number(casses);

    setSaving(true);
    setStockWarning("");
    setGlobalError("");

    try {
      const { error: insertProdError } = await supabase.from("egg_production").insert({
        flock_id: selectedFlock,
        production_date: prodDate,
        petit: p,
        moyen: m,
        gros: g,
        extra: e,
        casses: c,
        owner_id: user?.id,
      });

      if (insertProdError) {
        throw new Error(`Erreur insertion ponte : ${insertProdError.message}`);
      }

      const results = await Promise.all([
        updateProductStock("Plaquette d'œufs petit calibre", "Plaquette d'œufs", "Plaquette (30 œufs)", p),
        updateProductStock("Plaquette d'œufs moyen calibre", "Plaquette d'œufs", "Plaquette (30 œufs)", m),
        updateProductStock("Plaquette d'œufs gros calibre", "Plaquette d'œufs", "Plaquette (30 œufs)", g),
        updateProductStock("Plaquette d'œufs extra calibre", "Plaquette d'œufs", "Plaquette (30 œufs)", e),
        updateProductStock("Œufs cassés", "Plaquette d'œufs", "Unité", c),
      ]);

      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        const messages = failures.map((f) => `${f.name} (${f.error || "erreur inconnue"})`);
        setStockWarning(
          `Ponte enregistrée, mais le stock n'a pas été mis à jour pour : ${messages.join(", ")}.`
        );
        console.error("Échecs de mise à jour des stocks :", failures);
      } else {
        setStockWarning("");
      }

      setPetit("");
      setMoyen("");
      setGros("");
      setExtra("");
      setCasses("");
      setProdErrors({});
    } catch (err) {
      console.error(err);
      setGlobalError("Une erreur est survenue lors de l'enregistrement. Vérifie ta connexion.");
    } finally {
      setSaving(false);
    }
    load();
  };

  const handleReform = async () => {
    const errors: Record<string, string> = {};
    if (!reformFlockId) errors.reformFlockId = "Sélectionne un lot.";
    if (!reformNbHeads) errors.reformNbHeads = "Ce champ est obligatoire.";
    else {
      const nb = Number(reformNbHeads);
      if (nb <= 0) errors.reformNbHeads = "Doit être supérieur à 0.";
      else {
        const available = currentCount(reformFlockId);
        if (nb > available) errors.reformNbHeads = `Il n'y a que ${available} têtes dans ce lot.`;
      }
    }

    setReformErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setReformSaving(true);
    try {
      const { error: insertError } = await supabase.from("reforms").insert({
        lot_id: reformFlockId,
        nb_heads: Number(reformNbHeads),
        observations: reformObservations.trim() || null,
        owner_id: user?.id,
      });
      if (insertError) throw insertError;

      const result = await updateProductStock(
        "Poules réformées",
        "Poussins / Poulettes",
        "Tête",
        Number(reformNbHeads)
      );
      if (!result.ok) {
        console.warn(`Échec mise à jour stock Poules réformées : ${result.error}`);
      }

      setReformFlockId(flocks.length > 0 ? flocks[0].id : "");
      setReformNbHeads("");
      setReformObservations("");
      setReformErrors({});
      load();
    } catch (err: any) {
      console.error(err);
      setReformErrors({ general: err.message || "Erreur lors de l'enregistrement" });
    } finally {
      setReformSaving(false);
    }
  };

  const handleManure = async () => {
    const errors: Record<string, string> = {};
    if (!manureFlockId) errors.manureFlockId = "Sélectionne un lot.";
    if (!manureQuantity) errors.manureQuantity = "Ce champ est obligatoire.";
    else {
      const q = Number(manureQuantity);
      if (q <= 0) errors.manureQuantity = "Doit être supérieur à 0.";
    }

    setManureErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setManureSaving(true);
    try {
      const { error: insertError } = await supabase.from("manure_productions").insert({
        lot_id: manureFlockId,
        quantity_kg: Number(manureQuantity),
        observations: manureObservations.trim() || null,
        owner_id: user?.id,
      });
      if (insertError) throw insertError;

      const result = await updateProductStock("Fientes / Fumier", "Fientes / Fumier", "Sac", Number(manureQuantity));
      if (!result.ok) {
        console.warn(`Échec mise à jour stock Fientes / Fumier : ${result.error}`);
      }

      setManureFlockId(flocks.length > 0 ? flocks[0].id : "");
      setManureQuantity("");
      setManureObservations("");
      setManureErrors({});
      load();
    } catch (err: any) {
      console.error(err);
      setManureErrors({ general: err.message || "Erreur lors de l'enregistrement" });
    } finally {
      setManureSaving(false);
    }
  };

  // --- Indicateurs ---
  const totalHens = flocks
    .filter((f) => f.status === "laying")
    .reduce((sum, f) => sum + currentCount(f.id), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const eggTotal = (e: ProductionEntry) => e.petit + e.moyen + e.gros + e.extra;

  const todayTotal = entries
    .filter((e) => e.production_date === todayStr)
    .reduce((sum, e) => sum + eggTotal(e), 0);

  const weekTotal = entries
    .filter((e) => e.production_date >= sevenDaysAgo)
    .reduce((sum, e) => sum + eggTotal(e), 0);

  const layingRate = totalHens > 0 ? ((todayTotal / totalHens) * 100).toFixed(1) : "0";
  const rateNum = Number(layingRate);
  const rateColor =
    rateNum === 0
      ? "text-gray-400"
      : rateNum >= 85
      ? "text-green-600"
      : rateNum >= 70
      ? "text-amber-600"
      : "text-red-600";

  const alerts: string[] = [];
  flocks.forEach((f) => {
    const w = ageInWeeks(f);
    if (f.status === "laying" && w >= REFORM_AGE_WEEKS) {
      alerts.push(`${f.name} : ${w} semaines — envisager la réforme.`);
    }
  });
  if (totalHens > 0 && rateNum > 0 && rateNum < 70) {
    alerts.push(
      `Taux de ponte bas aujourd'hui (${layingRate}%) — vérifie l'alimentation et la santé du cheptel.`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Production</h1>
        <p className="text-sm text-gray-500">Suivi des lots et de la ponte quotidienne.</p>
      </div>

      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          {globalError}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Poules actives</p>
          <p className="text-xl font-bold text-gray-800">{totalHens.toLocaleString("fr-FR")}</p>
        </div>
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">Œufs aujourd'hui</p>
          <p className="text-xl font-bold text-gray-800">{todayTotal.toLocaleString("fr-FR")}</p>
        </div>
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase flex items-center gap-1">
            <TrendingUp size={12} /> Taux de ponte
          </p>
          <p className={`text-xl font-bold ${rateColor}`}>{layingRate}%</p>
        </div>
        <div className="stat-card !p-3">
          <p className="text-xs text-gray-400 uppercase">7 derniers jours</p>
          <p className="text-xl font-bold text-gray-800">{weekTotal.toLocaleString("fr-FR")}</p>
        </div>
      </div>

      {/* Lots */}
      <div className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Lots de poules</h2>
          <button
            onClick={() => setShowFlockForm(!showFlockForm)}
            className="flex items-center gap-1 text-xs text-green-700 font-medium"
          >
            <Plus size={14} />
            Nouveau lot
          </button>
        </div>

        {showFlockForm && (
          <div className="bg-green-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  placeholder="Nom du lot (ex: Lot A)"
                  value={flockName}
                  onChange={(e) => setFlockName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    flockErrors.flockName ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {flockErrors.flockName && (
                  <p className="text-xs text-red-600 mt-1">{flockErrors.flockName}</p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Nombre de têtes (ex: 15000)"
                  value={flockCount}
                  onChange={(e) => setFlockCount(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    flockErrors.flockCount ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {flockErrors.flockCount && (
                  <p className="text-xs text-red-600 mt-1">{flockErrors.flockCount}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <select
                  value={flockBreed}
                  onChange={(e) => setFlockBreed(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {breedOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {flockBreed === "Autre" && (
                  <>
                    <input
                      placeholder="Précise la race"
                      value={flockBreedCustom}
                      onChange={(e) => setFlockBreedCustom(e.target.value)}
                      className={`w-full mt-2 border rounded-lg px-3 py-2 text-sm ${
                        flockErrors.flockBreedCustom ? "border-red-400" : "border-gray-200"
                      }`}
                    />
                    {flockErrors.flockBreedCustom && (
                      <p className="text-xs text-red-600 mt-1">{flockErrors.flockBreedCustom}</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <input
                  type="date"
                  value={flockDate}
                  onChange={(e) => setFlockDate(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    flockErrors.flockDate ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {flockErrors.flockDate && (
                  <p className="text-xs text-red-600 mt-1">{flockErrors.flockDate}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Âge à l'achat (en semaines)
              </label>
              <input
                type="number"
                min={0}
                placeholder="Ex: 0 pour des poussins d'un jour, 17 pour des poulettes"
                value={flockAgeWeeks}
                onChange={(e) => setFlockAgeWeeks(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  flockErrors.flockAgeWeeks ? "border-red-400" : "border-gray-200"
                }`}
              />
              {flockErrors.flockAgeWeeks ? (
                <p className="text-xs text-red-600 mt-1">{flockErrors.flockAgeWeeks}</p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">
                  Poussins d'un jour : 0 semaine. Poulettes prêtes à pondre : généralement 16 à 18
                  semaines.
                </p>
              )}
            </div>

            <button
              onClick={handleCreateFlock}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Créer le lot
            </button>
          </div>
        )}

        {flocks.length === 0 ? (
          <div className="text-center py-6">
            <Egg size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Aucun lot créé pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {flocks.map((f) => {
              const w = ageInWeeks(f);
              const toReform = f.status === "laying" && w >= REFORM_AGE_WEEKS;
              return (
                <div key={f.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 text-sm">{f.name}</p>
                        {toReform && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            À réformer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {f.breed || "Race non précisée"} · {w} semaines · Acheté le{" "}
                        {new Date(f.start_date).toLocaleDateString("fr-FR")}
                        {f.initial_age_weeks > 0 && ` (à ${f.initial_age_weeks} sem.)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-700 font-semibold text-sm">
                        {currentCount(f.id).toLocaleString("fr-FR")} têtes
                      </span>
                      <button
                        onClick={() => {
                          setMortalityFlock(mortalityFlock === f.id ? null : f.id);
                          setMortalityError("");
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Déclarer une perte"
                      >
                        <Skull size={15} />
                      </button>
                    </div>
                  </div>

                  {mortalityFlock === f.id && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Nombre de pertes"
                          value={mortalityCount}
                          onChange={(e) => setMortalityCount(e.target.value)}
                          className={`flex-1 border rounded-lg px-3 py-1.5 text-sm ${
                            mortalityError ? "border-red-400" : "border-gray-200"
                          }`}
                        />
                        <button
                          onClick={() => handleAddMortality(f.id)}
                          className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                        >
                          Déclarer
                        </button>
                        <button
                          onClick={() => {
                            setMortalityFlock(null);
                            setMortalityError("");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {mortalityError && (
                        <p className="text-xs text-red-600 mt-1">{mortalityError}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saisie de la ponte */}
      <div className="stat-card space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">Saisir la ponte du jour</h2>

        {stockWarning && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {stockWarning}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <select
              value={selectedFlock}
              onChange={(e) => setSelectedFlock(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                prodErrors.selectedFlock ? "border-red-400" : "border-gray-200"
              }`}
            >
              {flocks.length === 0 && <option value="">Aucun lot disponible</option>}
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {prodErrors.selectedFlock && (
              <p className="text-xs text-red-600 mt-1">{prodErrors.selectedFlock}</p>
            )}
          </div>
          <div>
            <input
              type="date"
              value={prodDate}
              onChange={(e) => setProdDate(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                prodErrors.prodDate ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.prodDate && (
              <p className="text-xs text-red-600 mt-1">{prodErrors.prodDate}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <label className="text-xs text-gray-500">Petit</label>
            <input
              type="number"
              value={petit}
              onChange={(e) => setPetit(e.target.value)}
              className={`w-full border rounded-lg px-2 py-2 text-sm ${
                prodErrors.petit ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.petit && <p className="text-xs text-red-600 mt-1">{prodErrors.petit}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500">Moyen</label>
            <input
              type="number"
              value={moyen}
              onChange={(e) => setMoyen(e.target.value)}
              className={`w-full border rounded-lg px-2 py-2 text-sm ${
                prodErrors.moyen ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.moyen && <p className="text-xs text-red-600 mt-1">{prodErrors.moyen}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500">Gros</label>
            <input
              type="number"
              value={gros}
              onChange={(e) => setGros(e.target.value)}
              className={`w-full border rounded-lg px-2 py-2 text-sm ${
                prodErrors.gros ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.gros && <p className="text-xs text-red-600 mt-1">{prodErrors.gros}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500">Extra</label>
            <input
              type="number"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className={`w-full border rounded-lg px-2 py-2 text-sm ${
                prodErrors.extra ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.extra && <p className="text-xs text-red-600 mt-1">{prodErrors.extra}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500">Cassés</label>
            <input
              type="number"
              value={casses}
              onChange={(e) => setCasses(e.target.value)}
              className={`w-full border rounded-lg px-2 py-2 text-sm ${
                prodErrors.casses ? "border-red-400" : "border-gray-200"
              }`}
            />
            {prodErrors.casses && <p className="text-xs text-red-600 mt-1">{prodErrors.casses}</p>}
          </div>
        </div>

        <button
          onClick={handleSaveProduction}
          disabled={saving || flocks.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer la ponte"}
        </button>
      </div>

      {/* Réforme des poules */}
      <div className="stat-card space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">Réforme des poules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <select
              value={reformFlockId}
              onChange={(e) => setReformFlockId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({currentCount(f.id)} têtes)
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="number"
              placeholder="Nombre de têtes réformées"
              value={reformNbHeads}
              onChange={(e) => setReformNbHeads(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                reformErrors.reformNbHeads ? "border-red-400" : "border-gray-200"
              }`}
            />
            {reformErrors.reformNbHeads && (
              <p className="text-xs text-red-600 mt-1">{reformErrors.reformNbHeads}</p>
            )}
          </div>
        </div>
        <div>
          <textarea
            placeholder="Observations (optionnel)"
            value={reformObservations}
            onChange={(e) => setReformObservations(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            rows={1}
          />
        </div>
        {reformErrors.general && <p className="text-xs text-red-600">{reformErrors.general}</p>}
        <button
          onClick={handleReform}
          disabled={reformSaving || flocks.length === 0}
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {reformSaving ? "Enregistrement..." : "Enregistrer la réforme"}
        </button>
      </div>

      {/* Production de fumier */}
      <div className="stat-card space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">Production de fumier</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <select
              value={manureFlockId}
              onChange={(e) => setManureFlockId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="number"
              step="0.1"
              placeholder="Quantité (Kg)"
              value={manureQuantity}
              onChange={(e) => setManureQuantity(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                manureErrors.manureQuantity ? "border-red-400" : "border-gray-200"
              }`}
            />
            {manureErrors.manureQuantity && (
              <p className="text-xs text-red-600 mt-1">{manureErrors.manureQuantity}</p>
            )}
          </div>
        </div>
        <div>
          <textarea
            placeholder="Observations (optionnel)"
            value={manureObservations}
            onChange={(e) => setManureObservations(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            rows={1}
          />
        </div>
        {manureErrors.general && <p className="text-xs text-red-600">{manureErrors.general}</p>}
        <button
          onClick={handleManure}
          disabled={manureSaving || flocks.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {manureSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      {/* Historique des pontes */}
      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des pontes</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <Egg size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Aucune saisie pour l'instant.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Date / Heure de saisie</th>
                <th className="pb-2 pr-4 font-medium text-right">Petit</th>
                <th className="pb-2 pr-4 font-medium text-right">Moyen</th>
                <th className="pb-2 pr-4 font-medium text-right">Gros</th>
                <th className="pb-2 pr-4 font-medium text-right">Extra</th>
                <th className="pb-2 pr-4 font-medium text-right">Cassés</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2 pr-4 text-right">{e.petit}</td>
                  <td className="py-2 pr-4 text-right">{e.moyen}</td>
                  <td className="py-2 pr-4 text-right">{e.gros}</td>
                  <td className="py-2 pr-4 text-right">{e.extra}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{e.casses}</td>
                  <td className="py-2 text-right font-semibold text-gray-800">{eggTotal(e)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-700">
                <td className="pt-2 pr-4">Total ({entries.length} saisies)</td>
                <td className="pt-2 pr-4 text-right">{entries.reduce((s, e) => s + e.petit, 0)}</td>
                <td className="pt-2 pr-4 text-right">{entries.reduce((s, e) => s + e.moyen, 0)}</td>
                <td className="pt-2 pr-4 text-right">{entries.reduce((s, e) => s + e.gros, 0)}</td>
                <td className="pt-2 pr-4 text-right">{entries.reduce((s, e) => s + e.extra, 0)}</td>
                <td className="pt-2 pr-4 text-right text-gray-400">
                  {entries.reduce((s, e) => s + e.casses, 0)}
                </td>
                <td className="pt-2 text-right">{entries.reduce((s, e) => s + eggTotal(e), 0)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Historique des réformes */}
      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique des réformes</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : reforms.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune réforme enregistrée.</p>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Lot</th>
                <th className="pb-2 pr-8 font-medium text-right">Têtes réformées</th>
                <th className="pb-2 pr-6 font-medium">Observations</th>
                <th className="pb-2 font-medium">Date / Heure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reforms.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 text-gray-700">{r.lot?.name || "—"}</td>
                  <td className="py-2 pr-8 text-right font-medium">{r.nb_heads}</td>
                  <td className="py-2 pr-6 text-gray-500">{r.observations || "—"}</td>
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historique du fumier */}
      <div className="stat-card overflow-x-auto">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Historique du fumier</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : manureProductions.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune production enregistrée.</p>
        ) : (
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Lot</th>
                <th className="pb-2 pr-8 font-medium text-right">Quantité (Kg)</th>
                <th className="pb-2 pr-6 font-medium">Observations</th>
                <th className="pb-2 font-medium">Date / Heure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {manureProductions.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-4 text-gray-700">{m.lot?.name || "—"}</td>
                  <td className="py-2 pr-8 text-right font-medium">{m.quantity_kg}</td>
                  <td className="py-2 pr-6 text-gray-500">{m.observations || "—"}</td>
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("fr-FR")}
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
