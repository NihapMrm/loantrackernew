import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";

// Pages
import Index from "./pages/Index";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import AddPerson from "./pages/AddPerson";
import AddLoan from "./pages/AddLoan";
import LoanDetail from "./pages/LoanDetail";
import AddPayment from "./pages/AddPayment";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import AddAccount from "./pages/AddAccount";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/people" element={<People />} />
          <Route path="/person/:id" element={<PersonDetail />} />
          <Route path="/add-person" element={<AddPerson />} />
          <Route path="/edit-person/:id" element={<AddPerson />} />
          <Route path="/add-loan" element={<AddLoan />} />
          <Route path="/edit-loan/:id" element={<AddLoan />} />
          <Route path="/loan/:id" element={<LoanDetail />} />
          <Route path="/add-payment/:loanId" element={<AddPayment />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/account/:id" element={<AccountDetail />} />
          <Route path="/add-account" element={<AddAccount />} />
          <Route path="/edit-account/:id" element={<AddAccount />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
