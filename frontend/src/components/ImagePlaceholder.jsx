import React from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * The whole frame lifts and scales together on hover, so the screenshot is
 * never clipped by its own container. Motion is disabled when the user prefers
 * reduced motion.
 */
const liftClass =
  'transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:shadow-xl hover:shadow-slate-900/10 motion-safe:group-hover/visual:-translate-y-1.5 motion-safe:group-hover/visual:scale-[1.02]';

/** Soft brand-tinted glow that fades in behind the frame on hover. */
function Glow() {
  return (
    <div
      className="pointer-events-none absolute -inset-3 -z-10 rounded-[1.5rem] bg-gradient-to-tr from-brand-primary/20 via-brand-primary/5 to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover/visual:opacity-100"
      aria-hidden
    />
  );
}

/**
 * Landing page visual slot. Renders a real screenshot when `src` is provided,
 * otherwise shows a labeled placeholder for the asset file still needed.
 */
export default function ImagePlaceholder({
  name,
  label,
  src,
  alt,
  aspect = '16 / 10',
  fit = 'cover',
  className = '',
  icon: Icon = ImageIcon,
}) {
  const imageAlt = alt || label || name;

  if (src) {
    if (fit === 'natural') {
      return (
        <div className={`group/visual relative ${className}`}>
          <Glow />
          <div
            className={`overflow-hidden rounded-xl border border-[#e2e8f0] bg-slate-50 shadow-sm ${liftClass}`}
          >
            <img
              src={src}
              alt={imageAlt}
              className="block h-auto w-full"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      );
    }

    const objectClass =
      fit === 'contain'
        ? 'object-contain object-center bg-slate-50'
        : 'object-cover object-top';

    return (
      <div className={`group/visual relative w-full ${className}`}>
        <Glow />
        <div
          className={`relative w-full overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm ${liftClass}`}
          style={{ aspectRatio: aspect }}
        >
          <img
            src={src}
            alt={imageAlt}
            className={`absolute inset-0 h-full w-full ${objectClass}`}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`group/visual relative w-full ${className}`}>
      <Glow />
      <div
        className={`group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-brand-primary/30 bg-gradient-to-br from-brand-primary/[0.06] via-white to-slate-50 shadow-sm ${liftClass} hover:border-brand-primary/40`}
        style={{ aspectRatio: aspect }}
        role="img"
        aria-label={label ? `${label} placeholder` : `${name} placeholder`}
      >
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-primary/20 bg-white text-brand-primary shadow-sm transition-transform duration-300 group-hover:scale-110">
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
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
