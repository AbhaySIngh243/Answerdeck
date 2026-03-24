function mergeLinks(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const url of [...a, ...b]) {
    const u = typeof url === 'string' ? url.trim() : '';
    if (!u) continue;
    const norm = u.replace(/\/+$/, '').toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(u);
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
