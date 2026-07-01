import React from 'react';

const VARIANTS = {
  'hero-white': 'section-bridge section-bridge--hero-white',
  'white-soft': 'section-bridge section-bridge--white-soft',
  'soft-white': 'section-bridge section-bridge--soft-white',
  'white-glow': 'section-bridge section-bridge--white-glow',
  'glow-pricing': 'section-bridge section-bridge--glow-pricing',
};

export default function SectionTransition({ variant = 'white-soft' }) {
  return <div aria-hidden="true" className={VARIANTS[variant] || VARIANTS['white-soft']} />;
}
