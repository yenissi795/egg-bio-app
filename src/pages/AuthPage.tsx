import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Egg } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Compte créé avec succès. Tu peux maintenant te connecter.");
      setMode("signin");
      setPassword("");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Egg className="text-green-600" size={48} />
          <h1 className="text-2xl font-bold text-green-700 mt-2">ProD EGG BIO</h1>
          <p className="text-gray-500 text-sm">
            {mode === "signin" ? "Connectez-vous pour continuer" : "Créez votre compte"}
          </p>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setMessage("");
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "signin" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
            }`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            required
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            required
            minLength={6}
          />

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {message && <div className="text-green-700 text-sm">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? mode === "signin"
                ? "Connexion..."
                : "Création du compte..."
              : mode === "signin"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
