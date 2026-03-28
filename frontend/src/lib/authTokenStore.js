let tokenGetter = null;

export function setAuthTokenGetter(getter) {
  tokenGetter = getter;
}

export async function getAuthToken(forceRefresh = false) {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter(forceRefresh);
  } catch (_err) {
    return null;
  }
}

