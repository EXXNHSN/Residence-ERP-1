import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
