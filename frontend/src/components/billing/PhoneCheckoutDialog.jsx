import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';

/**
 * Modal for collecting a 10-digit Indian mobile number before Cashfree checkout.
 * Controlled by open/onClose/onSubmit.
 */
export default function PhoneCheckoutDialog({ open, onClose, onSubmit, busy = false }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPhone('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const digits = String(phone).replace(/\D/g, '').replace(/^91/, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    onSubmit(digits);
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
          Mobile number for checkout
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Cashfree requires a 10-digit Indian mobile number for secure checkout.
          We use it only for payment verification and receipts.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label htmlFor="checkout-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Mobile number
            </label>
            <input
              id="checkout-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(ev) => {
                setPhone(ev.target.value);
                setError('');
              }}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
            />
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
