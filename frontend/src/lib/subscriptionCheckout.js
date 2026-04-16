import { api } from './api';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export const PENDING_RAZORPAY_PLAN_KEY = 'pendingRazorpayPlan';

function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay requires a browser'));
  }
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      const onLoad = () => resolve(window.Razorpay);
      const onErr = () => reject(new Error('Failed to load Razorpay'));
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onErr);
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

/**
 * Opens Razorpay subscription checkout. Resolves "paid" on success, "dismissed" if modal closed.
 * @param {string} planKey "standard" | "pro"
 */
export async function startSubscriptionCheckout(planKey) {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key) {
    throw new Error('Missing VITE_RAZORPAY_KEY_ID (use the same publishable key id as RAZORPAY_KEY_ID).');
  }
  const { subscription_id: subscriptionId } = await api.createSubscription(planKey);
  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key,
      subscription_id: subscriptionId,
      name: 'Answerdeck',
      description: `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} — monthly`,
      theme: { color: '#2563eb' },
      handler() {
        resolve('paid');
      },
      modal: {
        ondismiss() {
          resolve('dismissed');
        },
      },
    });
    rzp.on('payment.failed', (response) => {
      const msg = response?.error?.description || response?.error?.reason || 'Payment failed';
      reject(new Error(msg));
    });
    rzp.open();
  });
}
