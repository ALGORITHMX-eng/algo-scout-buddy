import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AlgoDashboard from "./pages/algoscout/Dashboard.tsx";
import AlgoJobDetail from "./pages/algoscout/JobDetail.tsx";
import AlgoAddJob from "./pages/algoscout/AddJob.tsx";
import AlgoProfile from "./pages/algoscout/Profile.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/algoscout" element={<AlgoDashboard />} />
            <Route path="/algoscout/add" element={<AlgoAddJob />} />
            <Route path="/algoscout/profile" element={<AlgoProfile />} />
            <Route path="/algoscout/job/:id" element={<AlgoJobDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
