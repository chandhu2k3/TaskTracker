import React, { createContext, useState, useEffect } from "react";
import authService from "../services/authService";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);

  // Returns { requiresVerification, email } — does NOT set user
  const register = async (userData) => {
    const data = await authService.register(userData);
    return data;
  };

  const login = async (userData) => {
    const data = await authService.login(userData);
    setUser(data);
    return data;
  };

  const googleLogin = async (credential) => {
    const data = await authService.googleLogin(credential);
    setUser(data);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
