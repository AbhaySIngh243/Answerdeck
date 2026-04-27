let tokenGetter = null;

export function setAuthTokenGetter(getter) {
  // In React Strict Mode (dev), effects mount/unmount twice.
  // Clearing this getter even briefly can cause API calls to fire without auth.
  if (typeof getter === 'function') tokenGetter = getter;
}

export async function getAuthToken(forceRefresh = false) {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter(forceRefresh);
  } catch (_err) {
    return null;
  }
}

