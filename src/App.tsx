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
import AlgoChat from "./pages/algoscout/Chat.tsx";
import AlgoInterviewPrep from "./pages/algoscout/InterviewPrep.tsx";
import AlgoAuth from "./pages/algoscout/Auth.tsx";
import AlgoOnboarding from "./pages/algoscout/Onboarding.tsx";
import AlgoSettings from "./pages/algoscout/Settings.tsx";

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
            <Route path="/algoscout/auth" element={<AlgoAuth />} />
            <Route path="/algoscout/onboarding" element={<AlgoOnboarding />} />
            <Route path="/algoscout" element={<AlgoDashboard />} />
            <Route path="/algoscout/add" element={<AlgoAddJob />} />
            <Route path="/algoscout/profile" element={<AlgoProfile />} />
            <Route path="/algoscout/chat" element={<AlgoChat />} />
            <Route path="/algoscout/interview" element={<AlgoInterviewPrep />} />
            <Route path="/algoscout/settings" element={<AlgoSettings />} />
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
