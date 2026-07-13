import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import AppLayout from "@/components/AppLayout";
import AuthGuard from "@/components/AuthGuard";
import Dashboard from "./Dashboard";

const Index = () => {
  const userId = useAppStore((s) => s.currentUserId);
  if (!userId) return <Navigate to="/auth" replace />;
  return (
    <AuthGuard>
      <AppLayout>
        <Dashboard />
      </AppLayout>
    </AuthGuard>
  );
};

export default Index;
