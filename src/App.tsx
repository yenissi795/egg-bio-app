import { Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import AppLayout from "./components/AppLayout";

// Pages existantes
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import SuppliersPage from "./pages/SuppliersPage";
import ClientsPage from "./pages/ClientsPage";
import ProductionPage from "./pages/ProductionPage";
import SalesPage from "./pages/SalesPage";
import CashPage from "./pages/CashPage";
import CashMovementsPage from "./pages/CashMovementsPage";
import PurchasesPage from "./pages/PurchasesPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReceivablesPage from "./pages/ReceivablesPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import CashDetailPage from "./pages/CashDetailPage";
import { SettingsProvider } from "./context/SettingsContext";
import OptimizationPage from "./pages/OptimizationPage";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <AuthPage />;

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Page d'accueil */}
        <Route index element={<HomePage />} />

        {/* Modules principaux */}
        <Route path="produits" element={<ProductsPage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="ventes" element={<SalesPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="fournisseurs" element={<SuppliersPage />} />
        <Route path="achats" element={<PurchasesPage />} />
        <Route path="depenses" element={<ExpensesPage />} />
        <Route path="creances" element={<ReceivablesPage />} />

        {/* Grande caisse (consultation) + Fonds & Épargne (saisie, page séparée) */}
        <Route path="caisse" element={<CashPage />} />
        <Route path="caisse/details/:type" element={<CashDetailPage />} />
        <Route path="fonds" element={<CashMovementsPage />} />

        {/* Nouveaux modules */}
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="rapports" element={<ReportsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="optimisation" element={<OptimizationPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
