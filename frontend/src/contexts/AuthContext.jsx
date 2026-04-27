import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import { setAuthTokenGetter } from '../lib/authTokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { getToken, signOut, isLoaded, userId } = useClerkAuth();
  const { user } = useUser();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    setTokenReady(false);
    setAuthTokenGetter(async (forceRefresh = false) => {
      const first = await getToken({ skipCache: forceRefresh });
      if (first) return first;
      // After navigation or cold start, Clerk sometimes needs a non-cached read.
      return await getToken({ skipCache: true });
    });
    setTokenReady(true);
    return () => {
      setTokenReady(false);
      // Do not clear token getter: StrictMode cleanup would create a brief unauthenticated gap.
    };
  }, [getToken]);

  const value = useMemo(
    () => ({
      user,
      loading: !isLoaded || (Boolean(userId) && !tokenReady),
      isSignedIn: Boolean(userId),
      signOut: async () => await signOut(),
      getIdToken: async (forceRefresh = false) => {
        return await getToken({ skipCache: forceRefresh });
      },
    }),
    [user, isLoaded, userId, tokenReady, signOut, getToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

