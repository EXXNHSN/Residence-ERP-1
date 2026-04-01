import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/Login";
import { Sidebar } from "@/components/layout/Sidebar";

import Dashboard from "@/pages/Dashboard";
import BlocksPage from "@/pages/blocks/index";
import ApartmentsPage from "@/pages/apartments/index";
import ObjectsPage from "@/pages/objects/index";
import CustomersPage from "@/pages/customers/index";
import CustomerDetailPage from "@/pages/customers/detail";
import SalesPage from "@/pages/sales/index";
import CreateSalePage from "@/pages/sales/create";
import InstallmentsPage from "@/pages/installments/index";
import RentalsPage from "@/pages/rentals/index";
import CommunalPage from "@/pages/communal/index";
import InternetPage from "@/pages/internet/index";
import TariffsPage from "@/pages/tariffs/index";
import AdminSetupPage from "@/pages/admin/Setup";
import AdminUsersPage from "@/pages/admin/Users";
import QuartersPage from "@/pages/admin/Quarters";
import ConfigurePage from "@/pages/admin/Configure";
import SettingsPage from "@/pages/admin/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-72 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/blocks" component={BlocksPage} />
          <Route path="/apartments" component={ApartmentsPage} />
          <Route path="/objects" component={ObjectsPage} />
          <Route path="/customers" component={CustomersPage} />
          <Route path="/customers/:id" component={CustomerDetailPage} />
          <Route path="/sales" component={SalesPage} />
          <Route path="/sales/create" component={CreateSalePage} />
          <Route path="/installments" component={InstallmentsPage} />
          <Route path="/rentals" component={RentalsPage} />
          <Route path="/communal" component={CommunalPage} />
          <Route path="/internet" component={InternetPage} />
          <Route path="/tariffs" component={TariffsPage} />
          <Route path="/quarters" component={QuartersPage} />
          <Route path="/admin/setup" component={AdminSetupPage} />
          <Route path="/admin/users" component={AdminUsersPage} />
          <Route path="/admin/configure" component={ConfigurePage} />
          <Route path="/admin/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AppRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
