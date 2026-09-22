import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Common";
import { Login } from "./pages/Login";
import { Analyze } from "./pages/Analyze";
import { History, PredictionDetail } from "./pages/History";
import { Analytics } from "./pages/Analytics";
import { Performance } from "./pages/Performance";
import { Admin } from "./pages/Admin";
import { Feedback, Help } from "./pages/Support";

function Protected({
  children,
  employee = false,
  admin = false,
}: {
  children: ReactNode;
  employee?: boolean;
  admin?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if ((employee && user.role === "GUEST") || (admin && user.role !== "ADMIN"))
    return <Navigate to="/analyze" replace />;
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<Navigate to="/analyze" replace />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route
              path="/history"
              element={
                <Protected employee>
                  <History />
                </Protected>
              }
            />
            <Route
              path="/history/:id"
              element={
                <Protected employee>
                  <PredictionDetail />
                </Protected>
              }
            />
            <Route
              path="/analytics"
              element={
                <Protected employee>
                  <Analytics />
                </Protected>
              }
            />
            <Route
              path="/performance"
              element={
                <Protected employee>
                  <Performance />
                </Protected>
              }
            />
            <Route
              path="/feedback"
              element={
                <Protected employee>
                  <Feedback />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <Protected admin>
                  <Admin />
                </Protected>
              }
            />
            <Route path="/help" element={<Help />} />
          </Route>
          <Route path="*" element={<Navigate to="/analyze" replace />} />
        </Routes>
        <Toaster richColors position="bottom-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
