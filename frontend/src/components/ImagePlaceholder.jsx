import React from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * Branded image placeholder used across the landing page until real product
 * screenshots are dropped in. Renders a labeled box that names the asset file
 * a designer should supply (e.g. `visibility-dashboard.webp`). It never loads a
 * real image so the layout stays stable without any generated artwork.
 */
export default function ImagePlaceholder({
  name,
  label,
  aspect = '16 / 10',
  className = '',
  icon: Icon = ImageIcon,
}) {
  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-brand-primary/30 bg-gradient-to-br from-brand-primary/[0.06] via-white to-slate-50 ${className}`}
      style={{ aspectRatio: aspect }}
      role="img"
      aria-label={label ? `${label} placeholder` : `${name} placeholder`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-primary/20 bg-white text-brand-primary shadow-sm">
          <Icon className="h-6 w-6" strokeWidth={1.6} />
        </span>
        {label ? (
          <span className="text-sm font-semibold text-[#334155]">{label}</span>
        ) : null}
        <code className="rounded-md border border-brand-primary/15 bg-white/80 px-2.5 py-1 text-[11px] font-medium tracking-tight text-brand-primary">
          {name}
        </code>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
          Image placeholder
        </span>
      </div>
    </div>
  );
}
