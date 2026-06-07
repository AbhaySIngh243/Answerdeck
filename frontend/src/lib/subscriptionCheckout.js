import { api } from './api';
import { getAuthToken } from './authTokenStore';

const SCRIPT_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

export const PENDING_CASHFREE_PLAN_KEY = 'pendingCashfreePlan';

/** Prevent duplicate subscribe calls (Settings + dashboard auto-checkout). */
let checkoutInFlight = null;

async function requireFreshAuthToken() {
  let token = await getAuthToken(true);
  if (!token) {
    token = await getAuthToken(true);
  }
  if (!token) {
    throw new Error('Please sign out and sign in again, then retry checkout.');
  }
  return token;
}

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

async function resolveCustomerContact(user, overrides = {}, onRequestPhone) {
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
    if (typeof onRequestPhone === 'function') {
      phone = normalizePhone(await onRequestPhone());
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new Error('A valid 10-digit Indian mobile number is required for Cashfree checkout.');
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
 * Opens Cashfree PG checkout (one-time payment). Resolves "paid" on success, "redirected" after redirect.
 * @param {string} planKey "standard" | "pro"
 * @param {object} [options]
 * @param {object} [options.user] Clerk user object
 */
export async function startSubscriptionCheckout(planKey, options = {}) {
  if (checkoutInFlight) {
    return checkoutInFlight;
  }

  checkoutInFlight = (async () => {
    await requireFreshAuthToken();
    const { user, onRequestPhone, ...overrides } = options;
    const customer = await resolveCustomerContact(user, overrides, onRequestPhone);
    await requireFreshAuthToken();

    const session = await api.createSubscription(planKey, customer, {
      forceNew: Boolean(options.forceNew),
    });
    const paymentSessionId =
      session?.payment_session_id || session?.subscription_session_id;

    if (!paymentSessionId) {
      throw new Error('Missing payment session from server.');
    }

    const CashfreeFactory = await loadCashfreeScript();
    const cashfree = CashfreeFactory({ mode: resolveCashfreeMode() });

    if (typeof cashfree.checkout !== 'function') {
      throw new Error('Cashfree SDK is outdated. Reload the page and try again.');
    }

    const result = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: '_self',
    });

    if (result?.error) {
      const msg = result.error.message || result.error.code || 'Payment checkout failed';
      throw new Error(msg);
    }

    // _self navigates away to Cashfree; if we get a result without redirect, treat as completed in-page.
    if (result?.redirect || result?.paymentDetails) {
      return 'paid';
    }

    return 'redirected';
  })();

  try {
    return await checkoutInFlight;
  } finally {
    checkoutInFlight = null;
  }
}
