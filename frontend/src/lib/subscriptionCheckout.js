import { api } from './api';

const SCRIPT_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

export const PENDING_CASHFREE_PLAN_KEY = 'pendingCashfreePlan';

function loadCashfreeScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cashfree requires a browser'));
  }
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      const onLoad = () => resolve(window.Cashfree);
      const onErr = () => reject(new Error('Failed to load Cashfree'));
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onErr);
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve(window.Cashfree);
    s.onerror = () => reject(new Error('Failed to load Cashfree'));
    document.body.appendChild(s);
  });
}

function resolveCashfreeMode() {
  const mode = (import.meta.env.VITE_CASHFREE_MODE || 'sandbox').trim().toLowerCase();
  return mode === 'production' ? 'production' : 'sandbox';
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return digits.slice(2);
  }
  return digits;
}

function resolveCustomerContact(user, overrides = {}) {
  const email =
    overrides.customerEmail ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    '';
  let phone =
    overrides.customerPhone ||
    user?.primaryPhoneNumber?.phoneNumber ||
    user?.phoneNumbers?.[0]?.phoneNumber ||
    '';
  phone = normalizePhone(phone);

  if (!email) {
    throw new Error('Add an email address to your account before subscribing.');
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    const entered = window.prompt(
      'Cashfree requires a 10-digit Indian mobile number for subscription checkout.\nEnter your phone number:'
    );
    phone = normalizePhone(entered);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new Error('A valid 10-digit Indian mobile number is required.');
    }
  }

  const customerName =
    overrides.customerName ||
    user?.fullName ||
    user?.firstName ||
    email.split('@')[0] ||
    'Answerdeck User';

  return { customerEmail: email, customerPhone: phone, customerName };
}

/**
 * Opens Cashfree subscription checkout. Resolves "paid" on success, "dismissed" if closed.
 * @param {string} planKey "standard" | "pro"
 * @param {object} [options]
 * @param {object} [options.user] Clerk user object
 */
export async function startSubscriptionCheckout(planKey, options = {}) {
  const { user, ...overrides } = options;
  const customer = resolveCustomerContact(user, overrides);

  const { subscription_session_id: subscriptionSessionId } = await api.createSubscription(
    planKey,
    customer
  );

  if (!subscriptionSessionId) {
    throw new Error('Missing subscription session from server.');
  }

  const CashfreeFactory = await loadCashfreeScript();
  const cashfree = CashfreeFactory({ mode: resolveCashfreeMode() });

  const result = await cashfree.checkout({
    paymentSessionId: subscriptionSessionId,
    redirectTarget: '_modal',
  });

  if (result?.error) {
    const msg =
      result.error.message || result.error.code || 'Payment failed';
    throw new Error(msg);
  }

  if (result?.paymentDetails || result?.redirect) {
    return 'paid';
  }

  return 'dismissed';
}
