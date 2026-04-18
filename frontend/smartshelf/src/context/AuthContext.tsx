import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/src/store/auth';

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
  const {
    isAuthenticated,
    user: stateUser,
    isHydrating,
    initialize,
    signIn: signInStore,
    signOut: signOutStore,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const signIn = async (emailOrUsername: string, password: string) => {
    await signInStore(emailOrUsername, password);
  };

  const signOut = async () => {
    await signOutStore();
  };

  const user: User | null = useMemo(() => {
    if (!stateUser) {
      return null;
    }
    return {
      id: stateUser.id,
      email: stateUser.email,
      fullName: stateUser.full_name,
      username: stateUser.username,
    };
  }, [stateUser]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, loading: isHydrating, signIn, signOut }}
    >
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


