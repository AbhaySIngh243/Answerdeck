import React, { useEffect, useRef, useState } from 'react';

export default function RevealSection({ as: Tag = 'section', className = '', children, id }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      id={id}
      ref={ref}
      className={`reveal-section ${visible ? 'is-visible' : ''} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

