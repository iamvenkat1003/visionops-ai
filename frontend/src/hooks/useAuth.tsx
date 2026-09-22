import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";
import type { User } from "../services/types";

interface Auth {
  user: User | null;
  loading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = () => {
    sessionStorage.removeItem("visionops-token");
    setUser(null);
  };
  useEffect(() => {
    if (sessionStorage.getItem("visionops-token"))
      api<User>("/api/auth/me")
        .then(setUser)
        .catch(logout)
        .finally(() => setLoading(false));
    else setLoading(false);
    window.addEventListener("session-expired", logout);
    return () => window.removeEventListener("session-expired", logout);
  }, []);
  const login = async (email?: string, password?: string) => {
    const result = await api<{ access_token: string; user: User }>(
      email ? "/api/auth/login" : "/api/auth/guest",
      {
        method: "POST",
        body: email ? JSON.stringify({ email, password }) : undefined,
      },
    );
    sessionStorage.setItem("visionops-token", result.access_token);
    setUser(result.user);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is missing");
  return auth;
}
