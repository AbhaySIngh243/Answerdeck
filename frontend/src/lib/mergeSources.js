function isHttpUrl(value = '') {
  return /^https?:\/\/[^\s]+$/i.test(String(value).trim());
}

function mergeLinks(a = [], b = []) {
  const byUrl = new Map();
  const out = [];
  for (const link of [...a, ...b]) {
    const obj = typeof link === 'string'
      ? { url: link.trim(), title: '' }
      : { url: String(link?.url || '').trim(), title: String(link?.title || '').trim() };
    const u = obj.url;
    if (!u || !isHttpUrl(u)) continue;
    const norm = u.replace(/\/+$/, '').toLowerCase();
    const prev = byUrl.get(norm);
    if (prev) {
      if (!prev.title && obj.title) prev.title = obj.title;
      continue;
    }
    const next = { url: u, title: obj.title };
    byUrl.set(norm, next);
    out.push(next);
  }
  return out;
}

/**
 * Merge citation rows that refer to the same site (e.g. cnet vs cnet.com).
 * Aggregates mentions, dedupes links, and records every raw domain string grouped.
 */
export function mergeSourcesByDomainKey(rows) {
  const map = new Map();
  for (const row of rows) {
    const raw = (row.domain || '').trim();
    if (!raw) continue;
    const key = raw
      .replace(/^www\./i, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\.(com|org|net)$/i, '');
    const prev = map.get(key);
    const mentions = Number(row.source_mentions) || 0;
    const rowLinks = Array.isArray(row.links) ? row.links : [];
    if (prev) {
      prev.source_mentions += mentions;
      if (raw.length > prev.label.length) prev.label = raw;
      prev.links = mergeLinks(prev.links, rowLinks);
      if (!prev.mergedDomains.includes(raw)) prev.mergedDomains.push(raw);
    } else {
      map.set(key, {
        domain: raw,
        label: raw,
        source_mentions: mentions,
        links: mergeLinks([], rowLinks),
        mergedDomains: [raw],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.source_mentions - a.source_mentions);
}
