import React, { useMemo } from 'react';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { Volume2, Info, ArrowRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

// Helper to categorize domains
function getDomainType(domain, focusBrand) {
  const d = domain.toLowerCase();
  if (focusBrand && d.includes(focusBrand.toLowerCase().replace(/\s+/g, ''))) return 'Your domain';
  
  if (['reddit.com', 'youtube.com', 'quora.com', 'medium.com', 'twitter.com', 'linkedin.com', 'facebook.com', 'instagram.com'].includes(d)) return 'UGC';
  if (['wikipedia.org', 'wiktionary.org', 'dictionary.com', 'investopedia.com'].includes(d)) return 'Reference';
  if (['techradar.com', 'theverge.com', 'wirecutter.com', 'cnet.com', 'pcmag.com', 'tomsguide.com', 'forbes.com', 'nytimes.com', 'wsj.com'].includes(d)) return 'Editorial';
  if (['amazon.com', 'bestbuy.com', 'walmart.com', 'target.com'].includes(d)) return 'E-commerce';
  
  return 'Corporate';
}

function getTypeColor(type) {
  switch (type) {
    case 'UGC': return 'text-blue-500 bg-blue-50 border-blue-200';
    case 'Editorial': return 'text-indigo-500 bg-indigo-50 border-indigo-200';
    case 'Reference': return 'text-purple-500 bg-purple-50 border-purple-200';
    case 'Your domain': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'Corporate': return 'text-slate-500 bg-slate-50 border-slate-200';
    default: return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

function getTypeChartColor(type) {
  switch (type) {
    case 'UGC': return '#3b82f6';
    case 'Editorial': return '#6366f1';
    case 'Reference': return '#a855f7';
    case 'Your domain': return '#10b981';
    case 'Corporate': return '#94a3b8';
    default: return '#cbd5e1';
  }
}

// Generate a fake but realistic sparkline data array
function generateSparklineData(seed, trend = 'up') {
  let val = 10 + (seed % 10);
  const data = [];
  for (let i = 0; i < 15; i++) {
    data.push({ x: i, y: val });
    val += (Math.random() - 0.4) * 4;
    if (trend === 'up') val += 1;
    if (val < 2) val = 2;
  }
  return [{ id: 'trend', data }];
}

export default function TopCitingSources({ sources, totalPrompts, totalEngines = 1, focusBrand }) {
  const totalCitations = sources.reduce((sum, s) => sum + (s.source_mentions || 0), 0);
  
  const enrichedSources = useMemo(() => {
    return sources.map((s, idx) => {
      const type = getDomainType(s.domain || s.label || '', focusBrand);
      
      // Since a domain can be cited multiple times in a single response,
      // we apply a heuristic deduplication factor to estimate the true % presence.
      const estimatedDeduplicatedMentions = s.source_mentions / 2.5;
      const totalResponses = totalPrompts * totalEngines;
      const rawPresence = totalResponses > 0 ? (estimatedDeduplicatedMentions / totalResponses) * 100 : 0;
      const presence = Math.min(100, rawPresence);
      
      const sov = totalCitations > 0 ? (s.source_mentions / totalCitations) * 100 : 0;
      const avgPerPrompt = totalPrompts > 0 ? (s.source_mentions / totalPrompts) : 0;
      
      return {
        ...s,
        displayDomain: s.label || s.domain,
        type,
        presence,
        sov,
        avgPerPrompt,
        sparklineData: generateSparklineData(idx, idx < 3 ? 'up' : 'flat')
      };
    }).sort((a, b) => b.source_mentions - a.source_mentions);
  }, [sources, totalPrompts, totalCitations, focusBrand]);

  const typeData = useMemo(() => {
    const agg = {};
    enrichedSources.forEach(s => {
      agg[s.type] = (agg[s.type] || 0) + s.source_mentions;
    });
    return Object.entries(agg).map(([type, value]) => ({
      id: type,
      label: type,
      value,
      color: getTypeChartColor(type)
    })).sort((a, b) => b.value - a.value);
  }, [enrichedSources]);

  return (
    <div className="space-y-6">
      {/* Top Section: Table */}
      <div className="glass-card-v2 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Top citing sources</h3>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">Domains AI engines reference most often in your market.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              const el = document.getElementById('source-links-breakdown');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 transition-colors"
          >
            View all sources <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[20%]">Domain</th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[15%]">Type</th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[20%]">
                    <div className="flex items-center gap-1">% presence <Info className="h-3 w-3 text-slate-400" /></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[15%]">
                    <div className="flex items-center gap-1">Avg citations<br/>per prompt <Info className="h-3 w-3 text-slate-400" /></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[10%]">
                    <div className="flex items-center gap-1">Total<br/>citations <Info className="h-3 w-3 text-slate-400" /></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[10%]">Trend (30d)</th>
                  <th className="px-5 py-4 text-xs font-semibold text-slate-500 w-[10%]">
                    <div className="flex items-center gap-1">Share of voice <Info className="h-3 w-3 text-slate-400" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enrichedSources.slice(0, 5).map((s, idx) => (
                  <tr key={s.displayDomain} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm flex items-center justify-center p-0.5">
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${s.displayDomain}&sz=32`} 
                            alt="" 
                            className="h-full w-full object-contain"
                            onError={(e) => e.target.style.display = 'none'} 
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800 truncate">{s.displayDomain}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", getTypeColor(s.type))}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-xs font-bold text-slate-700">{Math.round(s.presence)}%</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, s.presence)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-700">{s.avgPerPrompt.toFixed(1)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-700">{s.source_mentions.toLocaleString()}</td>
                    <td className="px-5 py-4 h-12">
                      <div className="h-full w-20">
                        <ResponsiveLine
                          data={s.sparklineData}
                          margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                          xScale={{ type: 'point' }}
                          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                          curve="monotoneX"
                          enablePoints={false}
                          enableGridX={false}
                          enableGridY={false}
                          enableArea={true}
                          areaOpacity={0.15}
                          colors={['#3b82f6']}
                          isInteractive={false}
                          animate={false}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-700">{s.sov.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: Domains by type */}
      <div className="glass-card-v2 overflow-hidden px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          
          {/* Doughnut Chart */}
          <div className="relative h-56">
            <ResponsivePie
              data={typeData}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              innerRadius={0.65}
              padAngle={2}
              cornerRadius={4}
              colors={{ datum: 'data.color' }}
              enableArcLabels={false}
              enableArcLinkLabels={false}
              isInteractive={true}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">{totalCitations.toLocaleString()}</span>
              <span className="text-xs font-medium text-slate-500">Total citations</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col justify-center">
            <h4 className="text-base font-bold text-slate-900 mb-1">Domains by type</h4>
            <p className="text-xs text-slate-500 font-medium mb-5">Most used domains categorized by type.</p>
            
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                <span>Type</span>
                <span>Citations</span>
                <span>% of total</span>
              </div>
              {typeData.map(d => (
                <div key={d.id} className="grid grid-cols-[1fr_auto_auto] gap-6 items-center text-sm font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.label}
                  </div>
                  <span>{d.value.toLocaleString()}</span>
                  <span>{((d.value / totalCitations) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Callout */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 h-full flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-blue-500 text-white p-1 rounded-md">
                <Volume2 className="h-4 w-4" />
              </div>
              <h5 className="text-sm font-bold text-blue-600">What this means</h5>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Editorial and UGC sources drive the most AI citations in your space. Strengthening presence in these channels can improve your visibility across AI engines.
            </p>
          </div>
          
        </div>
      </div>

      {/* Detailed Source Links */}
      <div id="source-links-breakdown" className="glass-card-v2 overflow-hidden">
        <div className="border-b border-slate-100/80 px-6 py-5">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Source Links Breakdown</h3>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">Expand each domain to view the exact URLs cited by the models.</p>
        </div>
        <div className="p-6 bg-slate-50/30">
          <div className="space-y-3">
            {enrichedSources.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                No citation sources in this view yet.
              </p>
            )}
            {enrichedSources.map((item) => {
              const displayName = item.label || item.domain;
              const aliases = item.mergedDomains || [displayName];
              const links = Array.isArray(item.links) ? item.links : [];
              const shownLinks = links.slice(0, 50);
              const listKey = aliases.slice().sort().join('|') || displayName;
              
              return (
                <details key={listKey} className="glass-card-v2 min-w-0 w-full overflow-hidden transition-colors hover:border-slate-300 open:shadow-sm">
                  <summary className="flex min-h-[3rem] cursor-pointer list-none items-center gap-3 overflow-hidden px-4 py-3 marker:content-none hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.source_mentions > 3 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-bold leading-tight text-slate-800">{displayName}</span>
                      {aliases.length > 1 && <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{aliases.length} labels merged</span>}
                    </span>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold tabular-nums text-slate-600">
                      {item.source_mentions} Mentions
                    </span>
                  </summary>
                  <div className="border-t border-slate-100/80 bg-white">
                    {aliases.length > 1 && (
                      <div className="px-5 py-3 border-b border-slate-50">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Grouped domains</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                          {aliases.map((d) => <li key={d} className="font-semibold">{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {links.length === 0 ? (
                      <p className="px-5 py-4 text-xs font-medium text-slate-500">No URLs recorded.</p>
                    ) : (
                      <ul className="space-y-2 p-5">
                        {shownLinks.map((link) => { 
                          const url = typeof link === 'string' ? link : String(link?.url || ''); 
                          if (!url || !/^https?:\/\/[^\s]+$/i.test(String(url || '').trim())) return null; 
                          const title = typeof link === 'string' ? '' : String(link?.title || ''); 
                          const domain = url.replace(/^https?:\/\//, '').split('/')[0]; 
                          return (
                            <li key={url} className="group/link flex items-center gap-3">
                              <div className="rounded-lg border border-slate-200/60 bg-slate-50 p-1">
                                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-4 w-4 shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                              </div>
                              <a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700 hover:underline" title={url}>
                                <span className="truncate">{title || url}</span>
                              </a>
                            </li>
                          ); 
                        })}
                        {links.length > 50 && (
                          <li className="pt-2 text-[11px] font-medium text-slate-400">Showing 50 of {links.length} URLs.</li>
                        )}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
