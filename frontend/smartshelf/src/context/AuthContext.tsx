import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  email: string;
  fullName: string;
  username: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: hydrate auth state from storage / API
    setLoading(false);
  }, []);

  const signIn = async (_email: string, _password: string) => {
    // TODO: implement real sign-in with backend
    setIsAuthenticated(true);
    setUser({
      id: 'demo-user',
      email: _email,
      fullName: 'Demo User',
      username: 'demo',
    });
  };

  const signOut = async () => {
    // TODO: clear tokens / storage
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};


