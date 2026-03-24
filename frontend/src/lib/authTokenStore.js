let tokenGetter = null;

export function setAuthTokenGetter(getter) {
  tokenGetter = getter;
}

export async function getAuthToken() {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch (_err) {
    return null;
  }
}

