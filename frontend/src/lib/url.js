const URL_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

export function normalizeWebsiteUrl(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';

  const withProtocol = URL_PROTOCOL_RE.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

export function getDomainFromWebsiteUrl(rawValue) {
  const normalized = normalizeWebsiteUrl(rawValue);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}
