import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCookieConsent, setCookieConsent } from '../lib/cookieConsent';
import { loadAnalyticsIfConfigured } from '../lib/analytics';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (consent === 'accepted') {
      loadAnalyticsIfConfigured();
      return;
    }
    if (consent === 'declined') return;
    setVisible(true);
  }, []);

  const accept = () => {
    setCookieConsent('accepted');
    loadAnalyticsIfConfigured();
    setVisible(false);
  };

  const decline = () => {
    setCookieConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-[#e2e8f0] bg-white/95 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p id="cookie-consent-title" className="text-sm font-semibold text-[#0f172a]">
            Cookie preferences
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#64748b]">
            We use essential cookies to keep you signed in and run the product. Optional analytics
            cookies help us understand traffic and improve Answrdeck. They are only loaded if you accept.{' '}
            <Link to="/privacy" className="font-medium text-brand-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={decline}
            className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#475569] transition-colors hover:bg-[#f8fafc]"
          >
            Decline optional
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3b82f6]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
