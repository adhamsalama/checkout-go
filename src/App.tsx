import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import { ListExpenses } from "./components/ListExpenses";
import { SearchPage } from "./components/SearchPage";
import PaymentPage from "./components/ListPayments";
import BudgetsPage from "./components/BudgetsPage";
import SettingsPage from "./components/SettingsPage";
import { TabBar } from "./components/ui/TabBar";
import { installBackButton } from "./components/ui/backButton";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    // Tabs replace history entries, so back from a pushed screen (Search) returns to its tab
    // and back from a tab exits the app.
    installBackButton(() => {
      if (window.history.state?.idx > 0) {
        navigateRef.current(-1);
        return true;
      }
      return false;
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/" element={<ListExpenses />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/payments" element={<PaymentPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </>
  );
}

export default App;
