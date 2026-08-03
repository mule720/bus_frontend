import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSavedUser, clearAuth, type AuthUser } from '@/lib/graphql';
import { useQueryClient } from '@tanstack/react-query';

interface AppContextValue {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  setUser: () => {},
  logout: () => {},
  sidebarOpen: false,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
});

export const useAppContext = () => useContext(AppContext);
export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AuthUser | null>(() => getSavedUser());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (user) qc.setQueryData(['me'], user);
  }, []);

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    qc.setQueryData(['me'], u);
  };

  const logout = () => {
    clearAuth();
    setUserState(null);
    qc.clear();
  };

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <AppContext.Provider value={{ user, setUser, logout, sidebarOpen, setSidebarOpen, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  );
};
