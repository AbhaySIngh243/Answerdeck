const CONSENT_KEY = 'answrdeck.cookie_consent';

/** @returns {'accepted' | 'declined' | null} */
export function getCookieConsent() {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'declined') return value;
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {'accepted' | 'declined'} choice */
export function setCookieConsent(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* ignore */
  }
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === 'accepted';
}
