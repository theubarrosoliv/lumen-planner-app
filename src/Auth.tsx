import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth";
import Agenda from "./pages/Agenda";
import CalendarPage from "./pages/Calendar";
import Habits from "./pages/Habits";
import Goals from "./pages/Goals";
import Projects from "./pages/Projects";
import MindMaps from "./pages/MindMaps";
import MindMapPage from "./pages/MindMap";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const wrap = (node: React.ReactNode) => (
  <AuthGuard>
    <AppLayout>{node}</AppLayout>
  </AuthGuard>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/agenda" element={wrap(<Agenda />)} />
            <Route path="/calendario" element={wrap(<CalendarPage />)} />
            <Route path="/habitos" element={wrap(<Habits />)} />
            <Route path="/metas" element={wrap(<Goals />)} />
            <Route path="/projetos" element={wrap(<Projects />)} />
            <Route path="/mapas" element={wrap(<MindMaps />)} />
            <Route path="/mapas/:id" element={wrap(<MindMapPage />)} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
