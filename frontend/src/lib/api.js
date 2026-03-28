import { getAuthToken } from './authTokenStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/** LLM / analysis routes often exceed the default 30s client timeout. */
const LONG_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_API_LONG_TIMEOUT_MS || 180000,
);

function apiBaseLooksLocal() {
  try {
    const { hostname } = new URL(API_BASE_URL);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Local: 60s. Production default 60s too (hosted APIs often cold-start; override with VITE_API_TIMEOUT_MS). */
const DEFAULT_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_API_TIMEOUT_MS || 60000,
);

function timeoutHintMessage(timeoutMs) {
  if (apiBaseLooksLocal()) {
    return `Request timed out after ${timeoutMs}ms. For local dev: confirm the backend is running (e.g. python app.py in backend/), then retry. Slow LLM work uses a longer limit — set VITE_API_LONG_TIMEOUT_MS in frontend/.env if needed (default ${LONG_REQUEST_TIMEOUT_MS}ms for those routes).`;
  }
  return `Request timed out after ${timeoutMs}ms. Check VITE_API_BASE_URL, CORS on the server, and that the API host is up.`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHelpfulError({ url, response, payload, isJson }) {
  const status = response?.status;
  const statusText = response?.statusText || '';
  const requestId =
    response?.headers?.get?.('x-request-id') ||
    response?.headers?.get?.('x-render-request-id') ||
    '';

  if (status === 401) {
    const detail =
      isJson && payload && typeof payload === 'object' && typeof payload.detail === 'string'
        ? payload.detail
        : '';
    const code =
      isJson && payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : '';
    if (code === 'Missing or invalid authorization header') {
      return new Error(
        'API request had no auth token. Try signing out and signing in again, then redeploy the frontend if the issue persists.',
      );
    }
    return new Error(
      detail
        ? `Unauthorized: ${detail}`
        : 'Session expired or unauthorized. Please sign in again.',
    );
  }

  let backendMessage =
    isJson && payload && typeof payload === 'object'
      ? payload.error || payload.message || payload.detail
      : null;
  if (
    isJson &&
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.details) &&
    payload.details.length > 0
  ) {
    const d = payload.details[0];
    const loc = Array.isArray(d?.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
    const msg = typeof d?.msg === 'string' ? d.msg : '';
    const line = [loc, msg].filter(Boolean).join(': ');
    if (line) {
      backendMessage =
        !backendMessage || backendMessage === 'Invalid input' ? line : `${backendMessage} (${line})`;
    }
  }

  const prefix = status ? `API ${status}${statusText ? ` ${statusText}` : ''}` : 'API error';
  const suffix = requestId ? ` (request_id: ${requestId})` : '';
  const details = backendMessage ? `: ${backendMessage}` : '';
  const err = new Error(`${prefix}${details}${suffix}`);

  // Attach a few fields for UI/telemetry if needed.
  err.name = 'ApiError';
  err.status = status;
  err.url = url;
  err.requestId = requestId || null;
  return err;
}

async function getAuthHeader() {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...options.headers };
  let forcedRefreshUsed = false;

  if (!headers.Authorization) {
    const authHeader = await getAuthHeader();
    if (authHeader?.Authorization) headers.Authorization = authHeader.Authorization;
  }

  const url = `${API_BASE_URL}${path}`;
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const retries = Number(options.retries ?? (method === 'GET' ? 2 : 0));

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await response.json() : await response.text();

      // Token can expire during long sessions. Refresh once and retry this request.
      if (response.status === 401 && !forcedRefreshUsed && !options.headers?.Authorization) {
        const refreshedToken = await getAuthToken(true);
        if (refreshedToken) {
          headers.Authorization = `Bearer ${refreshedToken}`;
          forcedRefreshUsed = true;
          continue;
        }
      }

      if (!response.ok) {
        throw buildHelpfulError({ url, response, payload, isJson });
      }

      return payload;
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      const isNetwork =
        isAbort ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('Load failed');

      lastErr = isAbort ? new Error(timeoutHintMessage(timeoutMs)) : err;

      // Retry only safe reads and only for network-like failures or 5xx.
      const status = err?.status;
      const shouldRetry = method === 'GET' && (isNetwork || (typeof status === 'number' && status >= 500));
      if (!shouldRetry || attempt === retries) break;

      await sleep(250 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastErr instanceof Error) {
    throw lastErr;
  }
  if (lastErr != null && lastErr !== '') {
    throw new Error(String(lastErr));
  }
  throw new Error(
    `Request failed (${method} ${url}). If this persists, confirm the API is running and VITE_API_BASE_URL matches it.`,
  );
}

export const api = {
  baseUrl: API_BASE_URL,

  health: () => request('/health'),

  getProjects: () => request('/projects/'),
  getProject: (projectId) => request(`/projects/${projectId}`),
  createProject: (body) =>
    request('/projects/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateProject: (projectId, body) =>
    request(`/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteProject: (projectId) =>
    request(`/projects/${projectId}`, {
      method: 'DELETE',
    }),
  inviteCollaborator: (projectId, email) =>
    request(`/projects/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),

  getPrompts: (projectId) => request(`/prompts/project/${projectId}`),
  createPrompt: (projectId, payload) =>
    request(`/prompts/project/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updatePrompt: (promptId, payload) =>
    request(`/prompts/${promptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deletePrompt: (promptId) =>
    request(`/prompts/${promptId}`, {
      method: 'DELETE',
    }),

  runPromptAnalysis: (promptId) =>
    request(`/analysis/run/${promptId}`, {
      method: 'POST',
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    }),
  runAllPromptAnalysis: (projectId) =>
    request(`/analysis/run-all/${projectId}`, {
      method: 'POST',
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    }),
  getJobStatus: (jobId) => request(`/analysis/status/${jobId}`),
  getPromptResults: (promptId) => request(`/analysis/results/${promptId}`),
  getEngines: () => request('/analysis/engines'),
  runTestPrompt: (projectId, payload) =>
    request(`/analysis/test/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    }),

  getProjectDashboard: (projectId) => request(`/reports/project/${projectId}/dashboard`),
  getDeepAnalysis: (projectId) => request(`/reports/project/${projectId}/deep-analysis`),
  getPromptAnalysis: (projectId) => request(`/reports/project/${projectId}/prompt-analysis`),
  getPromptDetail: (promptId) => request(`/reports/prompt/${promptId}/detail`),
  getSourcesIntelligence: (projectId) => request(`/reports/project/${projectId}/sources`),
  getCompetitorIntelligence: (projectId) => request(`/reports/project/${projectId}/competitors`),
  getIntelSummary: (projectId) => request(`/reports/project/${projectId}/intel-summary`),
  getGlobalAudit: (projectId) => request(`/reports/project/${projectId}/global-audit`),
  getActionPlaybook: (projectId, body) =>
    request(`/reports/project/${projectId}/actions/playbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    }),
  executeAction: (projectId, body) =>
    request(`/reports/project/${projectId}/actions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    }),
  getOverview: () => request('/reports/overview'),
};

export async function downloadFile(path, filename) {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: headers || {} });
  if (!response.ok) {
    throw buildHelpfulError({ url: `${API_BASE_URL}${path}`, response, payload: null, isJson: false });
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
