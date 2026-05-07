import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400 text-sm">Loading...</div>
    </div>
  );

  if (!session) return <Navigate to="/algoscout/auth" replace />;

  return <>{children}</>;
};

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
            <Route path="/algoscout/onboarding" element={
              <ProtectedRoute><AlgoOnboarding /></ProtectedRoute>
            } />
            <Route path="/algoscout" element={
              <ProtectedRoute><AlgoDashboard /></ProtectedRoute>
            } />
            <Route path="/algoscout/add" element={
              <ProtectedRoute><AlgoAddJob /></ProtectedRoute>
            } />
            <Route path="/algoscout/profile" element={
              <ProtectedRoute><AlgoProfile /></ProtectedRoute>
            } />
            <Route path="/algoscout/chat" element={
              <ProtectedRoute><AlgoChat /></ProtectedRoute>
            } />
            <Route path="/algoscout/interview" element={
              <ProtectedRoute><AlgoInterviewPrep /></ProtectedRoute>
            } />
            <Route path="/algoscout/settings" element={
              <ProtectedRoute><AlgoSettings /></ProtectedRoute>
            } />
            <Route path="/algoscout/job/:id" element={
              <ProtectedRoute><AlgoJobDetail /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;