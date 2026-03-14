const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = isJson ? payload.error || payload.message || 'Request failed' : 'Request failed';
    throw new Error(errorMessage);
  }

  return payload;
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
    }),
  runAllPromptAnalysis: (projectId) =>
    request(`/analysis/run-all/${projectId}`, {
      method: 'POST',
    }),
  getJobStatus: (jobId) => request(`/analysis/status/${jobId}`),
  getPromptResults: (promptId) => request(`/analysis/results/${promptId}`),
  getEngines: () => request('/analysis/engines'),
  runTestPrompt: (projectId, payload) =>
    request(`/analysis/test/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getProjectDashboard: (projectId) => request(`/reports/project/${projectId}/dashboard`),
  getDeepAnalysis: (projectId) => request(`/reports/project/${projectId}/deep-analysis`),
  getPromptAnalysis: (projectId) => request(`/reports/project/${projectId}/prompt-analysis`),
  getPromptDetail: (promptId) => request(`/reports/prompt/${promptId}/detail`),
  getSourcesIntelligence: (projectId) => request(`/reports/project/${projectId}/sources`),
  getCompetitorIntelligence: (projectId) => request(`/reports/project/${projectId}/competitors`),
  getIntelSummary: (projectId) => request(`/reports/project/${projectId}/intel-summary`),
  getGlobalAudit: (projectId) => request(`/reports/project/${projectId}/global-audit`),
  executeAction: (projectId, body) =>
    request(`/reports/project/${projectId}/actions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getOverview: () => request('/reports/overview'),
};

export async function downloadFile(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error('Download failed');
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
