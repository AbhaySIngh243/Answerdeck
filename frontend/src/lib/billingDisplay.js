/** Shared billing copy and formatting. Keep in sync with backend plan_provisioner.PLAN_DEFINITIONS. */

export const DEFAULT_PLAN_AMOUNTS = {
  standard: 10,
  pro: 15,
};

const PAYMENT_METHOD_LABELS = {
  upi: 'UPI',
  card: 'card',
  netbanking: 'net banking',
  wallet: 'wallet',
  enach: 'eNACH',
};

const STATUS_LABELS = {
  active: 'Active',
  paid: 'Paid',
  pending: 'Payment pending',
  failed: 'Payment failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  initialized: 'Payment incomplete',
  created: 'Payment incomplete',
};

export function formatPlanPrice(amount, currency = 'INR') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  const cur = String(currency || 'INR').toUpperCase();
  if (cur === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(value);
}

export function planAmountFromHealth(billingHealth, planKey) {
  const fromApi = billingHealth?.plans?.[planKey]?.amount;
  if (Number.isFinite(Number(fromApi))) return Number(fromApi);
  return DEFAULT_PLAN_AMOUNTS[planKey] ?? null;
}

export function billingCurrency(billingHealth) {
  return (billingHealth?.currency || 'INR').toUpperCase();
}

export function formatPaymentMethods(methods) {
  const list = Array.isArray(methods) ? methods : [];
  if (list.length === 0) return 'card';
  return list.map((m) => PAYMENT_METHOD_LABELS[m] || m).join(', ');
}

export function formatSubscriptionStatus(status) {
  const key = String(status || '').toLowerCase();
  return STATUS_LABELS[key] || (key ? key.replace(/_/g, ' ') : 'Unknown');
}

export function formatRenewalDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function isSandboxEnvironment(billingHealth) {
  return (billingHealth?.environment || 'sandbox').toLowerCase() === 'sandbox';
}

export function billingCycleNote(currency) {
  const cur = String(currency || 'INR').toUpperCase();
  if (cur === 'INR') {
    return 'One-time monthly payment via Cashfree (UPI, card, net banking). Pay again each month to renew.';
  }
  return 'One-time monthly payment via Cashfree. Pay again each month to renew.';
}
