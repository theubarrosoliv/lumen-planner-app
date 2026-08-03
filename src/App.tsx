import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import AuthGuard from "@/components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Agenda from "./pages/Agenda";
import CalendarPage from "./pages/Calendar";
import Habits from "./pages/Habits";
import Pessoal from "./pages/Pessoal";
import Profissional from "./pages/Profissional";
import MindMaps from "./pages/MindMaps";
import MindMapPage from "./pages/MindMap";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound.tsx";
// TEMP: remove this import along with src/components/FirstLaunchGateTEMP.tsx
import { FirstLaunchGate } from "@/components/FirstLaunchGateTEMP";

const queryClient = new QueryClient();

/**
 * One persistent AuthGuard + AppLayout instance for every authenticated
 * route, via <Outlet/>. Previously each route built its own
 * <AuthGuard><AppLayout>{page}</AppLayout></AuthGuard> tree, so React Router
 * remounted the sidebar/header/bottom-nav from scratch on every navigation
 * instead of just swapping the page content.
 */
function AuthedLayout() {
  return (
    <AuthGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthGuard>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* TEMP: see FirstLaunchGateTEMP.tsx */}
        <FirstLaunchGate>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route element={<AuthedLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/calendario" element={<CalendarPage />} />
                <Route path="/habitos" element={<Habits />} />
                <Route path="/pessoal" element={<Pessoal />} />
                <Route path="/profissional" element={<Profissional />} />
                <Route path="/mapas" element={<MindMaps />} />
                <Route path="/mapas/:id" element={<MindMapPage />} />
                <Route path="/notificacoes" element={<Notifications />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="/perfil" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </FirstLaunchGate>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
