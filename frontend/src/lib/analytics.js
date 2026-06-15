/**
 * Loads optional marketing/analytics scripts only after the user accepts cookies.
 * Configure via Vite env vars; nothing loads if IDs are unset.
 */

let loaded = false;

function injectScript(src, attrs = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  Object.entries(attrs).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });
  document.head.appendChild(script);
}

function loadGoogleAnalytics(measurementId) {
  const id = String(measurementId || '').trim();
  if (!id) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });

  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

function loadMicrosoftClarity(projectId) {
  const id = String(projectId || '').trim();
  if (!id) return;

  window.clarity =
    window.clarity ||
    function clarityStub() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
  injectScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
}

function loadMetaPixel(pixelId) {
  const id = String(pixelId || '').trim();
  if (!id) return;

  if (!window.fbq) {
    const n = function fbq() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    window.fbq = n;
    window._fbq = n;
  }
  window.fbq('init', id);
  window.fbq('track', 'PageView');
  injectScript('https://connect.facebook.net/en_US/fbevents.js');
}

function loadLinkedInInsight(partnerId) {
  const id = String(partnerId || '').trim();
  if (!id) return;

  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(id);
  injectScript('https://snap.licdn.com/li.lms-analytics/insight.min.js');
}

/** Call once after the user accepts analytics cookies. */
export function loadAnalyticsIfConfigured() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;

  loadGoogleAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID);
  loadMicrosoftClarity(import.meta.env.VITE_CLARITY_PROJECT_ID);
  loadMetaPixel(import.meta.env.VITE_META_PIXEL_ID);
  loadLinkedInInsight(import.meta.env.VITE_LINKEDIN_PARTNER_ID);
}
