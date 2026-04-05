import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "sales";
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "naxchivan_erp_user";
const TOKEN_KEY = "naxchivan_erp_token";

// Module-level token so patched fetch always reads the latest value
let _currentToken: string | null = null;

export function getAuthToken(): string | null {
  return _currentToken;
}

// Callback invoked when the server returns 401
let _onUnauthorized: (() => void) | null = null;

// Patch global fetch once: inject JWT Bearer header + handle 401 auto-logout
const _originalFetch = window.fetch.bind(window);
window.fetch = async function patchedFetch(input, init = {}) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;

  const isOurApi = url.startsWith("/") || url.includes(window.location.host);
  const token = _currentToken;

  if (isOurApi && token && !url.includes("/auth/login")) {
    const headers = new Headers(
      (init as RequestInit).headers ??
        (input instanceof Request ? input.headers : {})
    );
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await _originalFetch(input, { ...init, headers });
    if (response.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }
    return response;
  }

  return _originalFetch(input, init);
};

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    _currentToken = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  // Register 401 handler so the patched fetch can trigger logout
  useEffect(() => {
    _onUnauthorized = clearAuth;
    return () => { _onUnauthorized = null; };
  }, [clearAuth]);

  // On startup: restore stored token and verify it with the server
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (!storedToken || !storedUser) {
      setIsLoading(false);
      return;
    }

    _currentToken = storedToken;

    // Verify the token is still valid
    _originalFetch(`${BASE()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Token bitib");
        const data: AuthUser = await res.json();
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      })
      .catch(() => clearAuth())
      .finally(() => setIsLoading(false));
  }, [clearAuth]);

  const login = async (username: string, password: string) => {
    const res = await _originalFetch(`${BASE()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Giriş uğursuz oldu" }));
      throw new Error(err.error ?? "Giriş uğursuz oldu");
    }

    const data: { token: string; user: AuthUser } = await res.json();
    _currentToken = data.token;
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const logout = useCallback(() => clearAuth(), [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "admin", isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
