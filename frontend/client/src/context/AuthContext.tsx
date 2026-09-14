import {
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { loginAdmin, type LoginCredentials } from "../services/api";
import { AuthContext, type AuthContextType } from "./useAuth.ts";

const TOKEN_KEY = "pes_admin_token";

interface JwtPayload {
  sub?: string;
  exp?: number;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved && isTokenValid(saved)) {
      return saved;
    }
    if (saved) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return null;
  });

  const username = useMemo(() => {
    if (!token) return null;
    const payload = parseJwt(token);
    return payload?.sub ?? null;
  }, [token]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const res = await loginAdmin(credentials);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      username,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    [token, username, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
