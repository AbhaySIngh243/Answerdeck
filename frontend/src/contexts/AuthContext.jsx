import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import { setAuthTokenGetter } from '../lib/authTokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { getToken, signOut, isLoaded, userId } = useClerkAuth();
  const { user } = useUser();

  useEffect(() => {
    setAuthTokenGetter(async () => await getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  const value = useMemo(
    () => ({
      user,
      loading: !isLoaded,
      isSignedIn: Boolean(userId),
      signOut: async () => await signOut(),
      getIdToken: async (forceRefresh = false) => {
        return await getToken({ skipCache: forceRefresh });
      },
    }),
    [user, isLoaded, userId, signOut, getToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

