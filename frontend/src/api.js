const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(message, status, details = null) { super(message); this.name = 'ApiError'; this.status = status; this.details = details; }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail : detail?.message || 'Не удалось выполнить запрос.';
    throw new ApiError(message, response.status, detail);
  }
  return data;
}

export const api = {
  register: (payload) => request('/registrations', { method: 'POST', body: JSON.stringify(payload) }),
  admin: {
    login: (credentials) => request('/admin/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/admin/auth/logout', { method: 'POST' }),
    me: () => request('/admin/auth/me'),
    stats: () => request('/admin/stats'),
    teams: (params = '') => request(`/admin/teams${params}`),
    team: (id) => request(`/admin/teams/${id}`),
    deleteTeam: (id) => request(`/admin/teams/${id}`, { method: 'DELETE' }),
    exportUrl: `${API_BASE}/admin/export/csv`,
  },
};

