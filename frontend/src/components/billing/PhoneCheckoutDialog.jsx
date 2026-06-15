import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';

// Common markets first; covers the vast majority of buyers. Cashfree converts
// currency at checkout, so international numbers must be accepted too.
const COUNTRIES = [
  { code: 'IN', dial: '91', label: 'India (+91)' },
  { code: 'US', dial: '1', label: 'United States (+1)' },
  { code: 'GB', dial: '44', label: 'United Kingdom (+44)' },
  { code: 'CA', dial: '1', label: 'Canada (+1)' },
  { code: 'AU', dial: '61', label: 'Australia (+61)' },
  { code: 'AE', dial: '971', label: 'UAE (+971)' },
  { code: 'SG', dial: '65', label: 'Singapore (+65)' },
  { code: 'DE', dial: '49', label: 'Germany (+49)' },
  { code: 'FR', dial: '33', label: 'France (+33)' },
  { code: 'NL', dial: '31', label: 'Netherlands (+31)' },
  { code: 'IE', dial: '353', label: 'Ireland (+353)' },
  { code: 'NZ', dial: '64', label: 'New Zealand (+64)' },
  { code: 'ZA', dial: '27', label: 'South Africa (+27)' },
  { code: 'BR', dial: '55', label: 'Brazil (+55)' },
  { code: 'JP', dial: '81', label: 'Japan (+81)' },
];

function detectCountryCode() {
  try {
    const locale = navigator.language || navigator.languages?.[0] || '';
    const region =
      (typeof Intl !== 'undefined' && Intl.Locale
        ? new Intl.Locale(locale).region
        : null) || locale.split('-')[1];
    if (region && COUNTRIES.some((c) => c.code === region.toUpperCase())) {
      return region.toUpperCase();
    }
  } catch {
    /* ignore detection failures */
  }
  return 'IN';
}

/**
 * Modal for collecting a phone number (with country code) before Cashfree checkout.
 * Controlled by open/onClose/onSubmit. onSubmit receives the full digits incl. country code.
 */
export default function PhoneCheckoutDialog({ open, onClose, onSubmit, busy = false }) {
  const [countryCode, setCountryCode] = useState('IN');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCountryCode(detectCountryCode());
      setPhone('');
      setError('');
    }
  }, [open]);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0],
    [countryCode]
  );

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const national = String(phone).replace(/\D/g, '').replace(/^0+/, '');

    if (country.code === 'IN') {
      const indian = national.replace(/^91/, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(indian)) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      onSubmit(indian);
      return;
    }

    const full = `${country.dial}${national}`;
    if (national.length < 6 || full.length < 8 || full.length > 15) {
      setError('Enter a valid phone number for the selected country.');
      return;
    }
    onSubmit(full);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        aria-label="Close"
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-checkout-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 id="phone-checkout-title" className="text-lg font-semibold text-slate-900">
          Phone number for checkout
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Cashfree requires a contact number for secure checkout. We use it only for
          payment verification and receipts.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label htmlFor="checkout-country" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Country
            </label>
            <select
              id="checkout-country"
              value={countryCode}
              onChange={(ev) => {
                setCountryCode(ev.target.value);
                setError('');
              }}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
            >
              {COUNTRIES.map((c) => (
                <option key={`${c.code}-${c.dial}`} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="checkout-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Mobile number
            </label>
            <div className="flex items-stretch gap-2">
              <span className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-100 px-3 text-sm font-semibold text-slate-600">
                +{country.dial}
              </span>
              <input
                id="checkout-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder={country.code === 'IN' ? 'e.g. 9876543210' : 'phone number'}
                value={phone}
                onChange={(ev) => {
                  setPhone(ev.target.value);
                  setError('');
                }}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
              />
            </div>
            {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Continuing...' : 'Continue to payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
