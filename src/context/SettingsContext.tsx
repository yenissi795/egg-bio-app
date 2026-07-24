import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

interface CompanySettings {
  companyName: string;
  subtitle: string;
  phone: string;
  address: string;
  currency: string;
}

interface SettingsContextValue extends CompanySettings {
  loading: boolean;
  save: (data: CompanySettings) => Promise<void>;
}

const defaultSettings: CompanySettings = {
  companyName: "ProD EGG BIO",
  subtitle: "",
  phone: "",
  address: "",
  currency: "FCFA",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        companyName: data.company_name,
        subtitle: data.subtitle || "",
        phone: data.phone || "",
        address: data.address || "",
        currency: data.currency,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = async (data: CompanySettings) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("app_settings")
        .update({
          company_name: data.companyName,
          subtitle: data.subtitle,
          phone: data.phone,
          address: data.address,
          currency: data.currency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("app_settings").insert({
        owner_id: user.id,
        company_name: data.companyName,
        subtitle: data.subtitle,
        phone: data.phone,
        address: data.address,
        currency: data.currency,
      });
    }
    setSettings(data);
  };

  return (
    <SettingsContext.Provider value={{ ...settings, loading, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

// Formateur de montant qui utilise la devise choisie par l'utilisateur.
// À utiliser DANS un composant : const fmt = useCurrencyFormatter();
export function useCurrencyFormatter() {
  const { currency } = useSettings();
  return (n: number) => `${n.toLocaleString("fr-FR").replace(/[\u00A0\u202F\u2009]/g, " ")} ${currency}`;
}
