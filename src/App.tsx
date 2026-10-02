import { Capacitor } from "@capacitor/core";
import {
  BackButtonEvent,
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  useIonRouter,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { barChartOutline, cashOutline, cloudUploadOutline, listOutline, pieChartOutline } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Navigate, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import { ListExpenses } from "./components/ListExpenses";
import { SearchPage } from "./components/SearchPage";
import { AccountsPage } from "./components/AccountsPage";
import { AuditLogPage } from "./components/AuditLogPage";
import { LabelsPage } from "./components/LabelsPage";
import PaymentPage from "./components/ListPayments";
import BudgetsPage from "./components/BudgetsPage";
import SettingsPage from "./components/SettingsPage";

const HOME = "/expenses";

const tabs = [
  { path: HOME, label: "Expenses", icon: listOutline },
  { path: "/payments", label: "Payments", icon: cashOutline },
  { path: "/budgets", label: "Budgets", icon: pieChartOutline },
  { path: "/dashboard", label: "Stats", icon: barChartOutline },
  { path: "/settings", label: "Backup", icon: cloudUploadOutline },
];

/**
 * Android back: overlays (sheets, alerts) close first, since Ionic gives them a higher priority.
 * Then a pushed screen pops, another tab returns to Expenses, and Expenses exits the app.
 */
function useAndroidBack() {
  const router = useIonRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const app = import("@capacitor/app").then((m) => m.App);
    // Capacitor only forwards back presses to the page (and so to Ionic) while a listener exists.
    const listener = app.then((App) => App.addListener("backButton", () => {}));
    const onBack = (e: Event) =>
      (e as BackButtonEvent).detail.register(10, async () => {
        const r = routerRef.current;
        const { pathname } = r.routeInfo;
        const isTabRoot = tabs.some((t) => t.path === pathname);
        if (!isTabRoot && r.canGoBack()) r.goBack();
        else if (pathname !== HOME) r.push(HOME, "none", "replace");
        else (await app).exitApp();
      });
    document.addEventListener("ionBackButton", onBack);
    return () => {
      document.removeEventListener("ionBackButton", onBack);
      listener.then((l) => l.remove());
    };
  }, []);
}

function Tabs() {
  useAndroidBack();
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path={HOME} element={<ListExpenses />} />
        <Route path={`${HOME}/search`} element={<SearchPage />} />
        <Route path={`${HOME}/accounts`} element={<AccountsPage />} />
        <Route path={`${HOME}/labels`} element={<LabelsPage />} />
        <Route path="/payments" element={<PaymentPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/log" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to={HOME} replace />} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom" id="tab-bar">
        {tabs.map(({ path, label, icon }) => (
          <IonTabButton key={path} tab={path.slice(1)} href={path}>
            <IonIcon icon={icon} />
            <IonLabel>{label}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <Tabs />
      </IonReactRouter>
    </IonApp>
  );
}
