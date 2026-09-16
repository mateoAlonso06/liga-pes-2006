import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import {
  loginUser,
  registerUser,
  refreshAuthSession,
  logoutUser,
  uploadUserAvatar,
  deleteUserAvatar,
  type LoginCredentials,
  type AuthUser,
} from "../services/api";
import { AuthContext, type AuthContextType } from "./useAuth.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      try {
        const res = await refreshAuthSession();
        if (!ignore) {
          setToken(res.accessToken || res.token);
          setUser(res.user);
        }
      } catch {
        if (!ignore) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const res = await loginUser(credentials);
    setToken(res.accessToken || res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (credentials: LoginCredentials) => {
    const res = await registerUser(credentials);
    setToken(res.accessToken || res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setToken(null);
    setUser(null);
  }, []);

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!token) throw new Error("No autenticado");
      const res = await uploadUserAvatar(token, file);
      setUser(res.user);
    },
    [token]
  );

  const removeAvatar = useCallback(async () => {
    if (!token) throw new Error("No autenticado");
    const res = await deleteUserAvatar(token);
    setUser(res.user);
  }, [token]);

  const username = user?.username ?? null;
  const avatarUrl = user?.avatar_url ?? null;
  const role = user?.role ?? null;
  const isAdmin = role === "admin";

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      username,
      avatarUrl,
      role,
      isAdmin,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      register,
      logout,
      uploadAvatar,
      removeAvatar,
    }),
    [token, user, username, avatarUrl, role, isAdmin, isLoading, login, register, logout, uploadAvatar, removeAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
