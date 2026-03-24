import React from 'react';
import { Link } from 'react-router-dom';

/** Colored A mark — `/public/brand/logo-mark.png` */
const MARK = '/brand/logo-mark.png';
/** Full lockup SVG; viewBox cropped to artwork so `h-*` hits real letter size. */
const WORDMARK_SVG = '/brand/wordmark.svg';

const sizeStyles = {
  xs: {
    lockup: 'h-6 w-auto max-w-[min(96vw,14rem)] sm:h-8',
    mark: 'h-6 w-6 sm:h-7 sm:w-7',
  },
  sm: {
    lockup: 'h-9 w-auto max-w-[min(96vw,20rem)] sm:h-11',
    mark: 'h-8 w-8 sm:h-9 sm:w-9',
  },
  /** ~30% smaller than `md` — sticky header only; footer stays `md`. */
  nav: {
    lockup:
      'h-8 w-auto max-w-[min(96vw,26rem)] sm:h-9 sm:max-w-[min(92vw,28rem)] md:h-10 md:max-w-[min(90vw,32rem)]',
    mark: 'h-8 w-8 sm:h-9 sm:w-9 md:h-9 md:w-9',
  },
  md: {
    lockup:
      'h-11 w-auto max-w-[min(96vw,26rem)] sm:h-[3.25rem] md:h-14 md:max-w-[min(92vw,32rem)]',
    mark: 'h-9 w-9 sm:h-11 sm:w-11',
  },
  lg: {
    lockup: 'h-14 w-auto max-w-[min(98vw,30rem)] sm:h-[4.5rem] sm:max-w-none',
    mark: 'h-12 w-12 sm:h-14 sm:w-14',
  },
};

/**
 * `lockup` = SVG wordmark (includes mark + letters). `mark` = PNG icon only.
 */
export function BrandLogo({
  as: Tag = 'div',
  to,
  variant = 'lockup',
  size = 'md',
  className = '',
  imgClassName = '',
  ...rest
}) {
  const s = sizeStyles[size] || sizeStyles.md;

  const markImg = (
    <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
      <img
        src={MARK}
        alt=""
        className={`${s.mark} object-contain ${imgClassName}`}
        width={256}
        height={256}
        decoding="async"
      />
    </span>
  );

  const lockupImg = (
    <img
      src={WORDMARK_SVG}
      alt=""
      width={998}
      height={195}
      decoding="async"
      className={`block shrink-0 object-contain object-left ${s.lockup} ${imgClassName}`}
      aria-hidden
    />
  );

  const inner = variant === 'mark' ? markImg : lockupImg;

  const combined = `${className} inline-flex min-w-0 items-center`.trim();

  if (to) {
    return (
      <Link to={to} className={combined} aria-label="Answrdeck home" {...rest}>
        {inner}
      </Link>
    );
  }

  return (
    <Tag className={combined} {...rest}>
      {inner}
    </Tag>
  );
}

export default BrandLogo;
