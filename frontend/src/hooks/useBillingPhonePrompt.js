import React, { useCallback, useRef, useState } from 'react';
import PhoneCheckoutDialog from '../components/billing/PhoneCheckoutDialog';

/**
 * Returns a Cashfree-compatible onRequestPhone callback and the dialog element to render.
 */
export function useBillingPhonePrompt() {
  const resolverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestPhone = useCallback(() => {
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setOpen(true);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setBusy(false);
    if (resolverRef.current) {
      resolverRef.current.reject(new Error('Phone number required to continue checkout.'));
      resolverRef.current = null;
    }
  }, []);

  const handleSubmit = useCallback((digits) => {
    setBusy(true);
    if (resolverRef.current) {
      resolverRef.current.resolve(digits);
      resolverRef.current = null;
    }
    setOpen(false);
    setBusy(false);
  }, []);

  const phoneDialog = React.createElement(PhoneCheckoutDialog, {
    open,
    busy,
    onClose: close,
    onSubmit: handleSubmit,
  });

  return { requestPhone, phoneDialog };
}
