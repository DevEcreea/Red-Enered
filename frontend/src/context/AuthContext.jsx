import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);
const IMP_KEY = "enered_impersonate";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = unauth, object = authed
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    localStorage.removeItem(IMP_KEY); // login siempre arranca sin impersonar
    sessionStorage.removeItem("enered_admin_choice");
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("enered_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("enered_token");
    localStorage.removeItem(IMP_KEY);
    sessionStorage.removeItem("enered_admin_choice");
    setUser(false);
  };

  // Impersonación: admin_enered "entra como" una empresa. Se guarda en localStorage y
  // api.js inyecta el header en cada request; re-cargamos /auth/me para tomar el contexto.
  const enterEmpresa = async (empresa) => {
    localStorage.setItem(IMP_KEY, empresa);
    sessionStorage.setItem("enered_admin_choice", "1");
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  const exitEmpresa = async () => {
    localStorage.removeItem(IMP_KEY);
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, checking, enterEmpresa, exitEmpresa }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
